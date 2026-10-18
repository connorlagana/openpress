import "server-only";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import type { User } from "@/db/schema";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { rateLimit } from "../services/ratelimit";
import { authenticate, createUser } from "./accounts";
import { clientIp, setSessionCookie } from "./session";

// Rate-limited sign-up / sign-in that also starts a session. Shared by the
// auth pages and the combined sign-up + consent screen at /oauth/authorize.

/** First-touch attribution cookie, set on the landing page (see _landing/ref.tsx). */
const REF_COOKIE = "op_ref";

export async function signUpAndSignIn(input: { email: string; password: string; name?: string; honeypot?: string }): Promise<User> {
  // Honeypot: real users never see or fill this field.
  if (input.honeypot) throw new AppError("VALIDATION", "Something went wrong. Please try again.");
  const ip = clientIp(await headers()) ?? "unknown";
  await rateLimit(`signup:ip:${ip}`, 5, 3600);
  const signupSource = (await cookies()).get(REF_COOKIE)?.value;
  const user = await createUser({ email: input.email, password: input.password, name: input.name, signupSource });
  await setSessionCookie(user.id);
  return user;
}

export async function logInAndSignIn(email: string, password: string): Promise<User> {
  const ip = clientIp(await headers()) ?? "unknown";
  await rateLimit(`login:ip:${ip}`, config.authRateLimitPerMinute);
  await rateLimit(`login:email:${email.toLowerCase()}`, 20, 3600);
  const user = await authenticate(email, password);
  await setSessionCookie(user.id);
  return user;
}

/** User-safe message for an expected auth failure; anything else is rethrown. */
export function authErrorMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Check the form and try again.";
  throw e;
}
