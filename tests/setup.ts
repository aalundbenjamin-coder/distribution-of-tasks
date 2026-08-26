/**
 * Load .env before any test module runs.
 *
 * Prisma loads .env as a side effect of constructing its client, which means
 * anything that reads process.env.DATABASE_URL *before* the first client is
 * built sees nothing. Relying on that ordering is fragile, so the tests load
 * the file themselves and behave like the deployed app, where the platform
 * supplies real environment variables and no .env file exists.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file — expected in CI, where the variables are already set.
}
