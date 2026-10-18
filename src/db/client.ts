import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything that can run queries: the root db or a transaction. */
export type Queryable = Db | Tx;

const g = globalThis as unknown as { __folioDb?: Promise<Db> };

/**
 * DATABASE_URL selects the driver:
 *   postgres://...           Supabase / any Postgres (production)
 *   pglite://memory          in-memory Postgres (tests)
 *   pglite://./.data/dev     file-backed embedded Postgres (local dev, no Docker)
 * PGlite databases are migrated automatically on first use.
 */
export function getDb(): Promise<Db> {
  g.__folioDb ??= createDb().catch((err) => {
    g.__folioDb = undefined;
    throw err;
  });
  return g.__folioDb;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL ?? "pglite://./.data/dev";
  if (url.startsWith("pglite://")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const location = url.slice("pglite://".length);
    let client;
    if (location === "memory") client = new PGlite();
    else {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(path.dirname(path.resolve(location)), { recursive: true });
      client = new PGlite(path.resolve(location));
    }
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    // The pglite and postgres-js drivers share the same query-builder surface.
    return db as unknown as Db;
  }
  // prepare:false keeps us compatible with Supabase's transaction pooler / Hyperdrive.
  const client = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
  return drizzlePostgres(client, { schema });
}

/**
 * Run fn as a tenant: RLS policies see app_uid() = userId and the session role
 * is the unprivileged folio_app role. Use this for every user-scoped operation.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`set local role folio_app`);
    return fn(tx);
  });
}

/** Normalize db.execute() results across drivers (postgres-js: array, pglite: {rows}). */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

export { schema };
