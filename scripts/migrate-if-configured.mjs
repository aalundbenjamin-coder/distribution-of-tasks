/**
 * Apply pending migrations during the build, but only when there is a database
 * to apply them to.
 *
 * The trade-off here is deliberate. Running migrations in a build is normally
 * poor practice: a build that mutates state is one you cannot freely re-run.
 * But the alternative is that attaching a database leaves the app still broken
 * until someone clones the repository and runs a migration by hand, and that
 * step is exactly where a deployment stalls.
 *
 * `prisma migrate deploy` is safe to repeat — it applies only what is pending,
 * and takes an advisory lock so concurrent builds cannot race. Skipping when
 * DATABASE_URL is absent means a deployment with no database still builds and
 * serves its public pages, instead of failing outright.
 *
 * A migration that fails *does* fail the build, on purpose: the previous
 * deployment keeps serving, and the reason is in the build log rather than
 * hidden behind runtime errors.
 */

import { spawnSync } from 'node:child_process';

// A deployed build gets real environment variables from the platform and has no
// .env file. Locally the variable lives in .env, which node does not read on its
// own — load it so `npm run build` behaves the same in both places.
try {
  process.loadEnvFile();
} catch {
  // No .env file. Expected when the platform supplies the variables directly.
}

const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.info(
    '\n[migrate] DATABASE_URL is not set — skipping migrations.\n' +
      '[migrate] The build will succeed and public pages will render, but anything\n' +
      '[migrate] that reads or writes data will report that no database is configured.\n' +
      '[migrate] Add a Postgres store, then redeploy and this step will run.\n',
  );
  process.exit(0);
}

console.info('[migrate] DATABASE_URL is set — applying any pending migrations.');

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error(
    '\n[migrate] Migrations failed, so the build is being stopped before it can\n' +
      '[migrate] ship a version that would fail at runtime. The previous deployment\n' +
      '[migrate] keeps serving. Common causes: DATABASE_URL points somewhere\n' +
      '[migrate] unreachable, or the pooled connection cannot run migration\n' +
      '[migrate] statements — try the direct (unpooled) connection string.\n',
  );
  process.exit(result.status ?? 1);
}

console.info('[migrate] Database schema is up to date.');

/**
 * Optionally put the demo organisation into a deployed database.
 *
 * Set SEED_DEMO=1 on the deployment to show the app with people in it. This is
 * the additive seed, never the destructive one: it fills in whatever is missing
 * and deletes nothing, so accounts that signed up keep their sessions, their
 * consents and their administrator role. It is safe on every build because a
 * second run changes nothing the first one did.
 */
if (['1', 'true', 'yes'].includes(process.env.SEED_DEMO?.trim().toLowerCase() ?? '')) {
  console.info('[seed] SEED_DEMO is set — filling in any missing demo data.');

  const seeded = spawnSync('npx', ['tsx', 'prisma/seed.ts', '--additive'], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (seeded.status !== 0) {
    // The schema is already migrated and the app works without demo rows, so a
    // failure here is reported rather than allowed to hold back the deployment.
    console.error(
      '\n[seed] Could not write the demo data. The build continues: the schema is\n' +
        '[seed] up to date and the app runs, it just has no demo people in it. Run\n' +
        '[seed] `npm run db:demo` against the same DATABASE_URL to see the error.\n',
    );
  } else {
    console.info('[seed] Demo data is in place.');
  }
}
