"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { authenticate, createUser } from "@/server/auth/accounts";
import { clearSession, clientIp, setSessionCookie } from "@/server/auth/session";
import { rateLimit } from "@/server/services/ratelimit";

/** First-touch attribution cookie, set on the landing page (see _landing/ref.tsx). */
const REF_COOKIE = "op_ref";

export type FormState = { error?: string; fields?: Record<string, string> } | null;

/** Only allow same-site relative redirects. */
function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ip = clientIp(await headers()) ?? "unknown";
  const fields = { email: String(form.get("email") ?? ""), name: String(form.get("name") ?? "") };
  // Honeypot: real users never see or fill this field.
  if (form.get("website")) return { error: "Something went wrong. Please try again.", fields };
  try {
    await rateLimit(`signup:ip:${ip}`, 5, 3600);
    const signupSource = (await cookies()).get(REF_COOKIE)?.value;
    const user = await createUser({ email: fields.email, password: String(form.get("password") ?? ""), name: fields.name, signupSource });
    await setSessionCookie(user.id);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, fields };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Check the form and try again.", fields };
    throw e;
  }
  redirect(safeNext(form.get("next"), "/onboarding"));
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ip = clientIp(await headers()) ?? "unknown";
  const email = String(form.get("email") ?? "");
  try {
    await rateLimit(`login:ip:${ip}`, config.authRateLimitPerMinute);
    await rateLimit(`login:email:${email.toLowerCase()}`, 20, 3600);
    const user = await authenticate(email, String(form.get("password") ?? ""));
    await setSessionCookie(user.id);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, fields: { email } };
    throw e;
  }
  redirect(safeNext(form.get("next"), "/dashboard"));
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}
