"use server";

import { redirect } from "next/navigation";
import { authErrorMessage, logInAndSignIn, signUpAndSignIn } from "@/server/auth/flows";
import { clearSession } from "@/server/auth/session";

export type FormState = { error?: string; fields?: Record<string, string> } | null;

/** Only allow same-site relative redirects. */
function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const fields = { email: String(form.get("email") ?? ""), name: String(form.get("name") ?? "") };
  try {
    await signUpAndSignIn({ ...fields, password: String(form.get("password") ?? ""), honeypot: String(form.get("website") ?? "") });
  } catch (e) {
    return { error: authErrorMessage(e), fields };
  }
  redirect(safeNext(form.get("next"), "/onboarding"));
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  try {
    await logInAndSignIn(email, String(form.get("password") ?? ""));
  } catch (e) {
    return { error: authErrorMessage(e), fields: { email } };
  }
  redirect(safeNext(form.get("next"), "/dashboard"));
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}
