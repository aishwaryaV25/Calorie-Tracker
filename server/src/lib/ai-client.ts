import { config } from '../config.js';
import { badRequest, serviceUnavailable } from './errors.js';

const REQUEST_TIMEOUT_MS = 45_000;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image_url';
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';

  content: string | null | (TextContent | ImageContent)[];
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface CompletionRequest {
  messages: ChatMessage[];

  model?: string;
  tools?: ToolDefinition[];

  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;

  maxTokens?: number;

  reasoningEffort?: string;

  rejectionMessage?: string;
}

export interface CompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
}

export class AiResponseError extends Error {}

export const isAiConfigured = () => config.ai.isConfigured;

function assertConfigured(): void {
  if (!config.ai.isConfigured) {
    throw serviceUnavailable(
      'AI features are not configured on this server. Set AI_API_KEY to enable them.',
    );
  }
}

function responseFormat(jsonSchema: CompletionRequest['jsonSchema']) {
  if (!jsonSchema) {
    return {};
  }

  if (config.ai.jsonMode === 'object') {
    return { response_format: { type: 'json_object' } };
  }

  return {
    response_format: {
      type: 'json_schema',
      json_schema: { name: jsonSchema.name, schema: jsonSchema.schema, strict: true },
    },
  };
}

function stripReasoning(content: string | null): string | null {
  if (!content) {
    return content;
  }

  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function withSchemaInstruction(request: CompletionRequest): ChatMessage[] {
  if (config.ai.jsonMode !== 'object' || !request.jsonSchema) {
    return request.messages;
  }

  return [
    ...request.messages,
    {
      role: 'system',
      content: `Reply with a single JSON object and nothing else. It must match this JSON schema:\n${JSON.stringify(
        request.jsonSchema.schema,
      )}`,
    },
  ];
}

const MAX_RETRY_WAIT_MS = 6_000;

function rateLimitWait(response: Response): number | null {
  if (response.status !== 429) {
    return null;
  }

  const retryAfter = Number(response.headers.get('retry-after'));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter * 1_000) : null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Attempt {
  response: Response;

  errorText: string;
}

function shouldRetry({ response, errorText }: Attempt): boolean {
  const wait = rateLimitWait(response);

  if (wait !== null) {
    return wait <= MAX_RETRY_WAIT_MS;
  }

  return response.status === 400 && errorText.includes('tool_use_failed');
}

async function post(body: string): Promise<Attempt> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body,
    });

    return { response, errorText: response.ok ? '' : await response.text() };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw serviceUnavailable('The AI service took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createCompletion(request: CompletionRequest): Promise<CompletionResult> {
  assertConfigured();

  const body = JSON.stringify({
    model: request.model ?? config.ai.model,
    messages: withSchemaInstruction(request),
    temperature: request.temperature ?? 0.1,
    ...(request.maxTokens ? { max_completion_tokens: request.maxTokens } : {}),
    ...(request.tools ? { tools: request.tools } : {}),
    ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
    ...responseFormat(request.jsonSchema),
  });

  let attempt = await post(body);

  if (shouldRetry(attempt)) {
    await delay(rateLimitWait(attempt.response) ?? 0);
    attempt = await post(body);
  }

  const { response, errorText } = attempt;

  if (!response.ok) {

    console.error(`AI provider returned ${response.status}: ${errorText}`);

    if (response.status === 429) {

      const seconds = Math.ceil((rateLimitWait(response) ?? 0) / 1_000);

      throw serviceUnavailable(
        seconds > 0
          ? `The AI service is rate limited. Try again in about ${seconds} second${seconds === 1 ? '' : 's'}.`
          : 'The AI service is rate limited right now. Please try again in a moment.',
      );
    }

    if (response.status >= 400 && response.status < 500) {
      throw badRequest(request.rejectionMessage ?? 'The AI service could not process this request.');
    }

    throw serviceUnavailable('The AI service could not process this request.');
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  };

  const message = payload.choices?.[0]?.message;

  if (!message) {
    throw new AiResponseError('The AI service returned an empty response.');
  }

  return {
    content: stripReasoning(message.content ?? null),
    toolCalls: message.tool_calls ?? [],
  };
}

export function parseJsonContent<T>(content: string | null): T {
  if (!content) {
    throw new AiResponseError('The AI service returned no content to parse.');
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AiResponseError('The AI service returned malformed JSON.');
  }
}
