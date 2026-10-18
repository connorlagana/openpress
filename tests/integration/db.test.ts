import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, rowsOf, withUser } from "@/db/client";

describe("database bootstrap", () => {
  it("migrates and seeds the free plan", async () => {
    const db = await getDb();
    const rows = rowsOf<{ id: string }>(await db.execute(sql`select id from plans`));
    expect(rows.map((r) => r.id)).toContain("free");
  });

  it("withUser runs as the unprivileged role with app_uid set", async () => {
    const uid = "00000000-0000-0000-0000-000000000001";
    const rows = await withUser(uid, async (tx) =>
      rowsOf<{ role: string; uid: string }>(await tx.execute(sql`select current_user as role, app_uid() as uid`)),
    );
    expect(rows[0]).toEqual({ role: "folio_app", uid });
  });
});
