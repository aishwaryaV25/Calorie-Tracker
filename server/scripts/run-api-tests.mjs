import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: path.join(root, '.env') });

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl.startsWith('postgres')) {
  console.error(
    'API tests need a Postgres DATABASE_URL. Paste the Neon pooled URI into server/.env, then retry.',
  );
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  DIRECT_URL: process.env.DIRECT_URL || databaseUrl,
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-that-is-at-least-32-chars!!',
};

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npx', ['prisma', 'migrate', 'deploy']);
run('node', ['--import', 'tsx', '--test', '--test-concurrency=1', 'test/api/**/*.test.ts']);
