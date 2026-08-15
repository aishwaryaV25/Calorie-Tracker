import 'dotenv/config';

/**
 * Every environment variable the app reads, resolved and checked once at start-up.
 * Nothing else in the codebase touches `process.env`, so a missing or malformed
 * setting fails immediately with a clear message instead of surfacing as a
 * confusing runtime error on the first request that happens to need it.
 */

class ConfigError extends Error {
  constructor(problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

const problems: string[] = [];

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    problems.push(`${name} is required`);
    return '';
  }

  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function port(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    problems.push(`${name} must be a valid port number`);
    return fallback;
  }

  return parsed;
}

const nodeEnv = optional('NODE_ENV', 'development');

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  problems.push('NODE_ENV must be one of: development, test, production');
}

const jwtSecret = required('JWT_SECRET');

if (jwtSecret && jwtSecret.length < 32) {
  problems.push('JWT_SECRET must be at least 32 characters');
}

const databaseUrl = required('DATABASE_URL');
const directUrl = optional('DIRECT_URL', '');

if (databaseUrl && !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  problems.push(
    'DATABASE_URL must be a Postgres URI from Neon. A file: SQLite path is no longer valid.',
  );
}

if (directUrl && !/^postgres(ql)?:\/\//i.test(directUrl)) {
  problems.push('DIRECT_URL must be a Postgres URI from Neon.');
}

const corsOrigin = optional('CORS_ORIGIN', 'http://localhost:3000');

/**
 * The AI provider is addressed through the OpenAI chat-completions shape, which
 * several vendors implement. Pointing `AI_BASE_URL` elsewhere is enough to swap
 * provider, so nothing here is specific to OpenAI beyond the default.
 */
const aiApiKey = (process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? '').trim();
const aiBaseUrl = optional('AI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, '');
const aiModel = optional('AI_MODEL', process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini');

/**
 * Chat may use a different model from image extraction, because the two jobs ask
 * for different things: reading a photo needs vision, while the assistant needs
 * dependable tool calling and short replies. On a metered free tier they are also
 * budgeted separately, so splitting them stops a few chat turns from exhausting
 * the allowance for reading a photo. Left blank, one model does both.
 */
const aiChatModel = optional('AI_CHAT_MODEL', aiModel);

/**
 * How to ask for JSON back. `schema` sends a strict JSON schema, which OpenAI
 * honours exactly; `object` asks only for valid JSON and describes the shape in
 * the prompt instead, which is all most OpenAI-compatible providers support.
 */
const aiJsonMode = optional('AI_JSON_MODE', 'schema');

if (!['schema', 'object'].includes(aiJsonMode)) {
  problems.push('AI_JSON_MODE must be one of: schema, object');
}

/**
 * How hard a reasoning model should think before reading an image. Left blank the
 * parameter is not sent at all, because a provider that does not know it rejects
 * the whole request.
 *
 * Worth setting for a model that reasons by default: extraction asks a narrow
 * question with the answer shape already pinned down, so deliberation there mostly
 * buys latency and tokens.
 *
 * It applies to extraction alone, and the accepted values are why: they differ
 * per model, with "none" valid on Qwen and rejected by gpt-oss, which takes only
 * low, medium or high. Rather than keep a matching setting per model, chat sends
 * nothing and takes the provider's own default, which is what suits it anyway.
 */
const aiReasoningEffort = optional('AI_REASONING_EFFORT', '');

if (aiReasoningEffort && !['none', 'low', 'medium', 'high'].includes(aiReasoningEffort)) {
  problems.push('AI_REASONING_EFFORT must be empty or one of: none, low, medium, high');
}

/**
 * Gemini is a second provider: chat, and the PDF import's deep-analyse
 * fallback. Photos stay on Groq (`AI_*`) so a long conversation cannot spend
 * the vision quota. The two keys are independent for the same reason.
 */
const geminiApiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim();
const geminiModel = optional('GEMINI_MODEL', 'gemini-2.5-flash');
const geminiBaseUrl = optional(
  'GEMINI_BASE_URL',
  'https://generativelanguage.googleapis.com/v1beta',
).replace(/\/+$/, '');

if (problems.length > 0) {
  throw new ConfigError(problems);
}

function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, '') || '(unknown-db)';
    return `${database} @ ${parsed.hostname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: port('PORT', 4000),
  databaseUrl,
  databaseLabel: describeDatabase(databaseUrl),
  corsOrigins: corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    secret: jwtSecret,
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },
  ai: {
    apiKey: aiApiKey,
    baseUrl: aiBaseUrl,
    model: aiModel,
    chatModel: aiChatModel,
    jsonMode: aiJsonMode as 'schema' | 'object',
    reasoningEffort: aiReasoningEffort,
    /**
     * AI routes stay mounted without a key and return a clear 503, so the rest of
     * the app remains runnable for anyone who just wants to try the core features.
     */
    isConfigured: aiApiKey.length > 0,
  },
  gemini: {
    apiKey: geminiApiKey,
    model: geminiModel,
    baseUrl: geminiBaseUrl,
    isConfigured: geminiApiKey.length > 0,
  },
} as const;
