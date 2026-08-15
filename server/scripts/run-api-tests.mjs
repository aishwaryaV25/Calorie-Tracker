/**
 * Runs HTTP regression tests against an in-process API and a throwaway SQLite
 * file, so they never touch the developer's live diary.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./prisma/test.db',
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
