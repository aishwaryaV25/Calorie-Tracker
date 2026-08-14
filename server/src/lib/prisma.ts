import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

/**
 * Reused across the process. In watch mode the module can be re-evaluated on
 * reload, so the client is cached on `globalThis` to avoid exhausting the
 * database connection pool with orphaned clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
