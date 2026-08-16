import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

/**
 * Neon (and other hosted Postgres) reject a default Prisma pool of ~20
 * connections. Cap it unless the URL already sets one. A long-running
 * `tsx watch` process plus leftover clients from reloads is what exhausted
 * the pool during signup.
 */
function databaseUrlWithPoolCap(url: string): string {
  const parsed = new URL(url);

  if (!parsed.searchParams.has('connection_limit')) {
    parsed.searchParams.set('connection_limit', '5');
  }

  if (!parsed.searchParams.has('pool_timeout')) {
    parsed.searchParams.set('pool_timeout', '20');
  }

  if (parsed.hostname.includes('-pooler') && !parsed.searchParams.has('pgbouncer')) {
    parsed.searchParams.set('pgbouncer', 'true');
  }

  return parsed.toString();
}

function createPrisma() {
  return new PrismaClient({
    log: config.isProduction ? ['error'] : ['warn', 'error'],
    datasources: { db: { url: databaseUrlWithPoolCap(config.databaseUrl) } },
  });
}

/**
 * A client built before `prisma generate` added a model is still cached on
 * `globalThis` across tsx reloads. Drop it so the next construct sees the
 * current schema — otherwise `weightLog` (and any later model) is undefined.
 */
function discardIfStale(client: PrismaClient | undefined) {
  if (!client) {
    return undefined;
  }

  if (typeof (client as { weightLog?: { findFirst?: unknown } }).weightLog?.findFirst !== 'function') {
    void client.$disconnect();
    return undefined;
  }

  return client;
}

/**
 * Reused across the process. In watch mode the module can be re-evaluated on
 * reload, so the client is cached on `globalThis` to avoid exhausting the
 * database connection pool with orphaned clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = discardIfStale(globalForPrisma.prisma) ?? createPrisma();

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
