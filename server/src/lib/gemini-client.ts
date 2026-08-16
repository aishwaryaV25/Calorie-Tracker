import { config } from '../config.js';
import type { ChatMessage, CompletionResult, ToolDefinition } from './ai-client.js';
import { badRequest, serviceUnavailable } from './errors.js';

const REQUEST_TIMEOUT_MS = 60_000;
const CHAT_TIMEOUT_MS = 20_000;
const CAPACITY_RETRY_MS = 800;

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

  maxTokens?: number;
  rejectionMessage?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function shouldTryNextGeminiModel(status: number, body: string): boolean {
  return (
    status === 503 ||
    status === 429 ||
    status === 404 ||
    /high demand|UNAVAILABLE|overloaded|no longer available|NOT_FOUND/i.test(body)
  );
}

export async function generateGeminiJson(request: GeminiRequest): Promise<string> {
  assertConfigured();

  const last = await tryModels(async (model) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${config.gemini.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.gemini.apiKey)}`,
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
      const errorText = response.ok ? '' : await response.text();
      return { response, errorText };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw serviceUnavailable('Gemini took too long to read this PDF. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });

  if (!last.response.ok) {
    console.error(`Gemini returned ${last.response.status}: ${last.errorText}`);

    if (last.response.status >= 400 && last.response.status < 500) {
      throw badRequest(
        request.rejectionMessage ?? 'Gemini could not read this PDF. It may be corrupt or too large.',
      );
    }

    throw serviceUnavailable('Gemini could not process this request. Try again in a moment.');
  }

  const payload = (await last.response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  if (!stripped) {
    throw serviceUnavailable('Gemini returned an empty reply.');
  }

  return stripped;
}

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

  const last = await tryModels(async (model) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.gemini.baseUrl}/openai/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.gemini.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: request.temperature ?? 0.5,

          reasoning_effort: 'minimal',
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
          ...(request.tools ? { tools: request.tools } : {}),
          ...(request.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      const errorText = response.ok ? '' : await response.text();
      return { response, errorText };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw serviceUnavailable('The chat service took too long to respond. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });

  if (!last.response.ok) {
    console.error(`Gemini chat returned ${last.response.status}: ${last.errorText}`);

    if (last.response.status >= 400 && last.response.status < 500) {
      throw badRequest(request.rejectionMessage ?? 'The chat service could not process this request.');
    }

    throw serviceUnavailable('The chat service is busy. Please try again in a moment.');
  }

  const payload = (await last.response.json()) as {
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

async function tryModels(
  send: (model: string) => Promise<{ response: Response; errorText: string }>,
): Promise<{ response: Response; errorText: string }> {
  let last: { response: Response; errorText: string } | undefined;

  for (const model of config.gemini.models) {
    const started = Date.now();
    last = await send(model);
    console.info(`Gemini ${model} ${last.response.status} ${Date.now() - started}ms`);

    if (last.response.ok) {
      if (model !== config.gemini.model) {
        console.info(`Gemini used fallback model ${model}`);
      }
      return last;
    }

    if (!shouldTryNextGeminiModel(last.response.status, last.errorText)) {
      return last;
    }

    console.warn(`Gemini ${model} unavailable (${last.response.status}); trying the next Flash model.`);
    if (last.response.status !== 404) {
      await delay(CAPACITY_RETRY_MS);
    }
  }

  return last ?? { response: new Response(null, { status: 503 }), errorText: '' };
}
