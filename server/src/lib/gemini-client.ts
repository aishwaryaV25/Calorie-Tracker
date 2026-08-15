import { config } from '../config.js';
import type { ChatMessage, CompletionResult, ToolDefinition } from './ai-client.js';
import { badRequest, serviceUnavailable } from './errors.js';

/**
 * The Gemini generateContent client.
 *
 * Kept in its own file because Gemini does not speak the OpenAI chat-completions
 * shape that Groq (and the rest of the app) uses. Mixing the two would mean
 * every Groq call growing Gemini-only branches, and a missing Gemini key
 * taking photo extraction down with it.
 */

const REQUEST_TIMEOUT_MS = 60_000;

export const isGeminiConfigured = () => config.gemini.isConfigured;

function assertConfigured(message?: string): void {
  if (!config.gemini.isConfigured) {
    throw serviceUnavailable(
      message ??
        'Deep Analyse is not configured. Set GEMINI_API_KEY to enable it. The script parse still works without it.',
    );
  }
}

export interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiRequest {
  parts: GeminiPart[];
  /** Caps the reply. A long diary can need a few thousand tokens of JSON. */
  maxTokens?: number;
  rejectionMessage?: string;
}

export async function generateGeminiJson(request: GeminiRequest): Promise<string> {
  assertConfigured();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(
      `${config.gemini.baseUrl}/models/${config.gemini.model}:generateContent?key=${encodeURIComponent(config.gemini.apiKey)}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: request.parts }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            maxOutputTokens: request.maxTokens ?? 8_192,
          },
        }),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw serviceUnavailable('Gemini took too long to read this PDF. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini returned ${response.status}: ${errorText}`);

    if (response.status === 429) {
      throw serviceUnavailable('Gemini is rate limited right now. Please try again in a moment.');
    }

    if (response.status >= 400 && response.status < 500) {
      throw badRequest(
        request.rejectionMessage ?? 'Gemini could not read this PDF. It may be corrupt or too large.',
      );
    }

    throw serviceUnavailable('Gemini could not process this request.');
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  if (!stripped) {
    throw serviceUnavailable('Gemini returned an empty reply.');
  }

  return stripped;
}

/**
 * Chat completions against Gemini's OpenAI-compatible endpoint. Photos stay on
 * Groq (`createCompletion`); this path is text and tools only, so a busy chat
 * cannot spend the vision quota.
 */
export async function createChatCompletion(request: {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
  maxTokens?: number;
  rejectionMessage?: string;
}): Promise<CompletionResult> {
  assertConfigured('Chat is not configured. Set GEMINI_API_KEY to enable the assistant.');

  const messages = request.jsonSchema
    ? [
        ...request.messages,
        {
          role: 'system' as const,
          content: `Reply with a single JSON object and nothing else. It must match this JSON schema:\n${JSON.stringify(request.jsonSchema.schema)}`,
        },
      ]
    : request.messages;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${config.gemini.baseUrl}/openai/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.gemini.apiKey}`,
      },
      body: JSON.stringify({
        model: config.gemini.model,
        messages,
        temperature: request.temperature ?? 0.5,
        ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        ...(request.tools ? { tools: request.tools } : {}),
        ...(request.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw serviceUnavailable('The chat service took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini chat returned ${response.status}: ${errorText}`);

    if (response.status === 429) {
      throw serviceUnavailable('The chat service is rate limited right now. Please try again in a moment.');
    }

    if (response.status >= 400 && response.status < 500) {
      throw badRequest(request.rejectionMessage ?? 'The chat service could not process this request.');
    }

    throw serviceUnavailable('The chat service could not process this request.');
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: CompletionResult['toolCalls'] } }[];
  };

  const message = payload.choices?.[0]?.message;

  if (!message) {
    throw serviceUnavailable('The chat service returned an empty response.');
  }

  const content = message.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() ?? null;

  return {
    content,
    toolCalls: message.tool_calls ?? [],
  };
}
