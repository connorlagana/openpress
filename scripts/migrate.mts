// Apply SQL migrations in ./drizzle to a Postgres database (Neon in production).
//
//   DATABASE_URL=postgres://... pnpm db:migrate   any database
//   pnpm db:migrate --prod                          production: PROD_DATABASE_URL from the
//                                                   environment or .env.production.local
//
// `pnpm deploy:cf` runs the --prod form between the build and the deploy, so new code
// never goes live against a schema that lacks its tables. Migrations must therefore be
// additive (the old Worker keeps serving until the deploy finishes).
// Use the direct (non-pooled) connection string.
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const prod = process.argv.includes("--prod");
if (prod && existsSync(".env.production.local")) process.loadEnvFile(".env.production.local");
const name = prod ? "PROD_DATABASE_URL" : "DATABASE_URL";
const url = process.env[name];

if (!url || !url.startsWith("postgres")) {
  console.error(
    prod
      ? "Set PROD_DATABASE_URL (production Postgres, direct connection) in .env.production.local or the environment. Deploy aborted before anything went live."
      : "Set DATABASE_URL to a postgres:// connection string (use the direct connection, not a transaction pooler).",
  );
  process.exit(1);
}

const host = new URL(url).host;
const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  const before = await applied(client);
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  const after = await applied(client);
  console.log(after > before ? `Applied ${after - before} migration(s) to ${host}.` : `${host} is up to date.`);
} catch (err) {
  console.error(`Migration failed on ${host}:`, err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}

async function applied(sql: postgres.Sql): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select case when to_regclass('drizzle.__drizzle_migrations') is null then 0
           else (select count(*)::int from drizzle.__drizzle_migrations) end as n`;
  return row.n;
}
