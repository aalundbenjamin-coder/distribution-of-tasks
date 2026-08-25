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

/**
 * A deployment with no DATABASE_URL builds perfectly and then fails on the
 * first query with a message about connection strings, which sends whoever is
 * setting it up looking in the wrong place. Say the actual problem instead.
 *
 * This is checked lazily rather than at module load: `next build` imports this
 * module while collecting page data, and a build should not require a live
 * database — migrations are a deliberate, separate step.
 */
function assertDatabaseConfigured(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  throw new Error(
    'DATABASE_URL is not set, so there is no database to talk to. ' +
      'Add a PostgreSQL connection string to the environment — on Vercel, add a ' +
      'Postgres store under Storage (which sets DATABASE_URL for you) and redeploy. ' +
      'Then apply the schema once with `npx prisma migrate deploy`.',
  );
}

function createClient(): PrismaClient {
  assertDatabaseConfigured();
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Constructed on first use rather than on import, so the check above runs when
 * a query is actually attempted. Every call site keeps using `prisma` exactly
 * as before.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = (globalForPrisma.prisma ??= createClient());
    // Read against the real client, not the proxy: Prisma exposes its model
    // delegates through getters, and handing those a proxy as `this` would send
    // their internal property reads straight back through this trap.
    const value = Reflect.get(client, property);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
