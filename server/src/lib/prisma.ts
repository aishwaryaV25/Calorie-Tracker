import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

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

// Drop a hot-reload client that was created before the latest Prisma schema.
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

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = discardIfStale(globalForPrisma.prisma) ?? createPrisma();

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
