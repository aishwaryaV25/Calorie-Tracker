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
  /** Null when the model replied with tool calls alone and no prose. */
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
  /** Defaults to the configured model, which is the one that can read images. */
  model?: string;
  tools?: ToolDefinition[];
  /** Ask the model for a JSON object conforming to this schema. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
  /** Caps the reply, which is what bounds the worst-case wait for the user. */
  maxTokens?: number;
  /**
   * Sent only when given. Left out the provider's own default applies, which is
   * the right choice whenever the caller cannot know that the model in use
   * accepts the value: providers disagree on which levels exist.
   */
  reasoningEffort?: string;
  /**
   * What to tell the user if the provider refuses the request outright. Supplied
   * by the caller because only it knows what the user was doing: the same 4xx
   * means "this photo cannot be read" on one path and "that message could not be
   * acted on" on another.
   */
  rejectionMessage?: string;
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
 * A rate limit worth waiting out rather than reporting. Metered free tiers refill
 * per minute, so a request that arrives just over the line is told to come back
 * in a second or two — quicker than the user could retry, and invisible to them.
 */
const MAX_RETRY_WAIT_MS = 6_000;

/** How long the provider asks us to wait, in milliseconds, or null if it did not. */
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
  /** The failure body, read once so it can be both classified and logged. */
  errorText: string;
}

/**
 * Whether a failed attempt is worth exactly one more.
 *
 * Two cases qualify. A rate limit the provider expects to clear in a moment,
 * and a tool call the model itself mangled — Groq validates the arguments the
 * model produced and rejects the request when they are not valid JSON, which is a
 * sampling accident rather than anything wrong with what was asked. Sampling
 * again almost always yields a well-formed call.
 */
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

/**
 * Single place where the app talks to the model provider. Everything else works
 * with plain objects, so swapping providers means editing this file only.
 */
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

  // Retried once only: if the second try fails too, the caller is better off
  // being told than held any longer.
  if (shouldRetry(attempt)) {
    await delay(rateLimitWait(attempt.response) ?? 0);
    attempt = await post(body);
  }

  const { response, errorText } = attempt;

  if (!response.ok) {
    // Provider errors are logged in full but summarised to the client, which has
    // no use for upstream detail and should not see account information.
    console.error(`AI provider returned ${response.status}: ${errorText}`);

    if (response.status === 429) {
      // Saying how long to wait is far more useful to a user than "try later".
      const seconds = Math.ceil((rateLimitWait(response) ?? 0) / 1_000);

      throw serviceUnavailable(
        seconds > 0
          ? `The AI service is rate limited. Try again in about ${seconds} second${seconds === 1 ? '' : 's'}.`
          : 'The AI service is rate limited right now. Please try again in a moment.',
      );
    }

    // A 4xx means the provider understood the request and refused it, so nothing
    // will change by sending the same thing again. Reporting that as a server
    // fault would send the user off retrying something that cannot succeed.
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
