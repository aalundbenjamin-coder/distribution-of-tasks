import { PrismaClient } from '@/generated/prisma';

/**
 * A single Prisma client for the process.
 *
 * Next.js reloads modules in development, which would otherwise open a new
 * connection pool on every edit until SQLite runs out of handles.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
