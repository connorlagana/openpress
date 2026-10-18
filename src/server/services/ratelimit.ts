import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "@/db/client";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limiter backed by Postgres so it holds across stateless
 * serverless instances. One upsert per check.
 */
export async function rateLimit(key: string, limit: number, windowSeconds = 60): Promise<{ remaining: number; resetAt: Date }> {
  const db = await getDb();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = rowsOf<{ count: number }>(
    await db.execute(sql`
      insert into rate_limits (key, window_start, count) values (${key}, ${windowStart.toISOString()}, 1)
      on conflict (key, window_start) do update set count = rate_limits.count + 1
      returning count`),
  );
  const count = Number(rows[0]?.count ?? 1);
  const resetAt = new Date(windowStart.getTime() + windowSeconds * 1000);
  if (Math.random() < 0.01) {
    await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  }
  if (count > limit) {
    throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again after ${resetAt.toISOString()}.`, {
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
    });
  }
  return { remaining: limit - count, resetAt };
}
