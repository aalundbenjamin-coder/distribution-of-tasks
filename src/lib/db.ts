import { PrismaClient } from '@/generated/prisma';

/**
 * A single Prisma client for the process.
 *
 * Next.js reloads modules in development, which would otherwise open a new
 * connection pool on every edit until the database refuses further connections.
 * In production the same singleton keeps one pool per warm serverless instance
 * rather than one per invocation.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
