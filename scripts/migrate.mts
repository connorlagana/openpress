// Apply SQL migrations in ./drizzle to DATABASE_URL (Supabase in production).
// Usage: DATABASE_URL=postgres://... pnpm db:migrate
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("postgres")) {
  console.error("Set DATABASE_URL to a postgres:// connection string (use the direct/session connection, not the transaction pooler).");
  process.exit(1);
}
const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
await client.end();
console.log("Migrations applied.");
