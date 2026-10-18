import { eq } from "drizzle-orm";
import { getDb, withUser } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import type { Actor } from "../actor";
import { audit } from "./audit";

export async function updateProfile(actor: Actor, name: string) {
  return withUser(actor.userId, async (tx) => {
    await tx.update(users).set({ name: name.trim().slice(0, 80) || null, updatedAt: new Date() }).where(eq(users.id, actor.userId));
  });
}

export async function changePassword(actor: Actor, current: string, next: string) {
  if (next.length < 10) throw new AppError("VALIDATION", "New password must be at least 10 characters.");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, actor.userId));
  if (!u) throw new AppError("UNAUTHORIZED", "Current password is incorrect.");
  // Accounts created with Google or Apple have no password yet; the session is enough to set one.
  if (u.passwordHash && !(await verifyPassword(current, u.passwordHash))) throw new AppError("UNAUTHORIZED", "Current password is incorrect.");
  const hash = await hashPassword(next);
  await withUser(actor.userId, async (tx) => {
    await tx.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, actor.userId));
    await audit(tx, actor, u.passwordHash ? "account.change_password" : "account.set_password");
  });
}
