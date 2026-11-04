// Apply SQL migrations in ./drizzle to a Postgres database (Neon in production).
//
//   DATABASE_URL=postgres://... pnpm db:migrate   any database
//   pnpm db:migrate --prod                          production: PROD_DATABASE_URL from the
//                                                   environment or .env.production.local
//
// Railway runs `pnpm db:migrate` as the pre-deploy command (railway.json) with the
// service's DATABASE_URL, and `pnpm deploy:cf` runs the --prod form between build and
// deploy, so new code never goes live against a schema that lacks its tables. A failed
// migration aborts the deploy. Migrations must be additive (the old version keeps
// serving until the new one is up).
// Migrations need a direct connection: a Neon pooled host (-pooler) is swapped for its direct host.
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const prod = process.argv.includes("--prod");
if (prod && existsSync(".env.production.local")) process.loadEnvFile(".env.production.local");
const name = prod ? "PROD_DATABASE_URL" : "DATABASE_URL";
const url = directUrl(process.env[name]);

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

/** Neon's pooled host (`ep-…-pooler.…neon.tech`) is pgbouncer in transaction mode; migrate over the direct host. */
function directUrl(raw: string | undefined): string | undefined {
  if (!raw?.startsWith("postgres")) return raw;
  const u = new URL(raw);
  if (!/-pooler\.[^.]+.*\.neon\.tech$/.test(u.hostname)) return raw;
  u.hostname = u.hostname.replace("-pooler.", ".");
  return u.toString();
}

async function applied(sql: postgres.Sql): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select case when to_regclass('drizzle.__drizzle_migrations') is null then 0
           else (select count(*)::int from drizzle.__drizzle_migrations) end as n`;
  return row.n;
}
