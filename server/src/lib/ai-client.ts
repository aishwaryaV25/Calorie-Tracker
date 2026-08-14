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
  content: string | (TextContent | ImageContent)[];
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
  tools?: ToolDefinition[];
  /** Ask the model for a JSON object conforming to this schema. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
  /** Caps the reply, which is what bounds the worst-case wait for the user. */
  maxTokens?: number;
}

export interface CompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
}

/** Thrown when the API is reachable but the response cannot be used. */
export class AiResponseError extends Error {}

export const isAiConfigured = () => config.ai.isConfigured;

function assertConfigured(): void {
  if (!config.ai.isConfigured) {
    throw serviceUnavailable(
      'AI features are not configured on this server. Set AI_API_KEY to enable them.',
    );
  }
}

/**
 * How to ask for JSON given the provider's capabilities.
 *
 * OpenAI enforces a JSON schema during decoding, so the reply is guaranteed to
 * match. Most compatible providers only offer plain JSON mode, where the schema
 * has to be described in the prompt and the reply merely tends to match — which
 * is why every field is re-checked in `sanitiseExtraction` regardless of mode.
 */
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

/**
 * Reasoning models emit their chain of thought in a `<think>` block ahead of the
 * answer unless asked not to. `AI_REASONING_EFFORT` turns that off at the
 * provider, but the block is stripped here as well so an unconfigured provider
 * cannot leak raw deliberation into a chat reply or break JSON parsing.
 */
function stripReasoning(content: string | null): string | null {
  if (!content) {
    return content;
  }

  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Plain JSON mode has no field for the schema, so it is appended to the
 * conversation as an instruction instead. This also satisfies the rule, common
 * to OpenAI and its imitators, that JSON mode requires the word "JSON" in the
 * prompt.
 */
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

/**
 * Single place where the app talks to the model provider. Everything else works
 * with plain objects, so swapping providers means editing this file only.
 */
export async function createCompletion(request: CompletionRequest): Promise<CompletionResult> {
  assertConfigured();

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
      body: JSON.stringify({
        model: config.ai.model,
        messages: withSchemaInstruction(request),
        temperature: request.temperature ?? 0.1,
        ...(request.maxTokens ? { max_completion_tokens: request.maxTokens } : {}),
        ...(request.tools ? { tools: request.tools } : {}),
        ...(config.ai.reasoningEffort
          ? { reasoning_effort: config.ai.reasoningEffort }
          : {}),
        ...responseFormat(request.jsonSchema),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      // Provider errors are logged in full but summarised to the client, which
      // has no use for upstream detail and should not see account information.
      console.error(`AI provider returned ${response.status}: ${body}`);

      // A 4xx means the provider understood the request and refused it, and the
      // only part a caller controls is the file they uploaded — an image too
      // small to analyse, or one that is corrupt. Reporting that as a server
      // fault would send them off to retry something that cannot succeed.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw badRequest(
          'The AI service could not read this file. It may be corrupt, too small, or in a format the model does not support.',
        );
      }

      if (response.status === 429) {
        // Free tiers are metered per minute and the provider says how long to
        // wait, which is far more useful to a user than "try again later".
        const retryAfter = Number(response.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null;

        throw serviceUnavailable(
          wait
            ? `The AI service is rate limited. Try again in about ${wait} second${wait === 1 ? '' : 's'}.`
            : 'The AI service is rate limited right now. Please try again in a moment.',
        );
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
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw serviceUnavailable('The AI service took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Parses a JSON payload returned by the model, with a clear error if it is malformed. */
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
