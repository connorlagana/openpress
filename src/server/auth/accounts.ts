import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { sessions, users, type User } from "@/db/schema";
import { config } from "@/lib/config";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

// Account and session primitives. These run with the privileged connection
// because they operate before a tenant identity exists.

export const signUpInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  name: z.string().trim().max(80).optional(),
  /** Attribution only; anything malformed is dropped rather than failing signup. */
  signupSource: z.string().regex(/^(site|utm):[a-z0-9_-]{1,40}$/).optional().catch(undefined),
});

export async function createUser(input: z.input<typeof signUpInput>): Promise<User> {
  const data = signUpInput.parse(input);
  const db = await getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, data.email));
  if (existing) throw new AppError("CONFLICT", "An account with that email already exists. Try signing in.");
  const [user] = await db
    .insert(users)
    .values({ email: data.email, passwordHash: await hashPassword(data.password), name: data.name || null, signupSource: data.signupSource ?? null })
    .returning();
  return user;
}

// Verified against a real hash even when the user doesn't exist, so response
// time doesn't reveal which emails are registered.
let dummyHash: Promise<string> | undefined;

export async function authenticate(email: string, password: string): Promise<User> {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()));
  dummyHash ??= hashPassword("timing-equalizer");
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) throw new AppError("UNAUTHORIZED", "Incorrect email or password.");
  if (user.suspendedAt) throw new AppError("SUSPENDED", "This account is suspended.");
  return user;
}

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const token = randomToken(32);
  const db = await getDb();
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 86400_000);
  await db.insert(sessions).values({ id: await sha256Hex(token), userId, expiresAt, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null });
  return { token, expiresAt };
}

export async function userForSessionToken(token: string): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, await sha256Hex(token)), gt(sessions.expiresAt, new Date())));
  if (!row || row.user.suspendedAt) return null;
  return row.user;
}

export async function deleteSession(token: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
}

export async function deleteAllSessions(userId: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
