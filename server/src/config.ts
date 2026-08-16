import 'dotenv/config';

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

const aiApiKey = (process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? '').trim();
const aiBaseUrl = optional('AI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, '');
const aiModel = optional('AI_MODEL', process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini');

const aiChatModel = optional('AI_CHAT_MODEL', aiModel);

const aiJsonMode = optional('AI_JSON_MODE', 'schema');

if (!['schema', 'object'].includes(aiJsonMode)) {
  problems.push('AI_JSON_MODE must be one of: schema, object');
}

const aiReasoningEffort = optional('AI_REASONING_EFFORT', '');

if (aiReasoningEffort && !['none', 'low', 'medium', 'high'].includes(aiReasoningEffort)) {
  problems.push('AI_REASONING_EFFORT must be empty or one of: none, low, medium, high');
}

const geminiApiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim();
const geminiModel = optional('GEMINI_MODEL', 'gemini-3.5-flash-lite');
const geminiBaseUrl = optional(
  'GEMINI_BASE_URL',
  'https://generativelanguage.googleapis.com/v1beta',
).replace(/\/+$/, '');

const geminiFallbacks = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];
const geminiModels = [geminiModel, ...geminiFallbacks].filter(
  (model, index, all) => model.length > 0 && all.indexOf(model) === index,
);

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
    isConfigured: aiApiKey.length > 0,
  },
  gemini: {
    apiKey: geminiApiKey,
    model: geminiModel,
    models: geminiModels,
    baseUrl: geminiBaseUrl,
    isConfigured: geminiApiKey.length > 0,
  },
} as const;
