import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { hmacHex, safeEqual } from "@/lib/crypto";
import type { Actor } from "./actor";

const TTL_MS = 10 * 60 * 1000;

/**
 * Two-step confirmation for destructive or publishing operations by agents.
 * The first call returns a short-lived token bound to (connection, action,
 * target); the agent must show the summary to its user and call again with it.
 */
export async function issueConfirmation(actor: Actor, action: string, targetId: string, summary: string): Promise<never> {
  const exp = Date.now() + TTL_MS;
  const principal = actor.kind === "agent" ? actor.connectionId : actor.userId;
  const sig = await hmacHex(config.secret, `${principal}|${action}|${targetId}|${exp}`);
  throw new AppError("CONFIRMATION_REQUIRED", summary, {
    confirmation_token: `${exp}.${sig}`,
    expires_at: new Date(exp).toISOString(),
    action,
    target_id: targetId,
  });
}

export async function verifyConfirmation(actor: Actor, action: string, targetId: string, token: string): Promise<boolean> {
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const principal = actor.kind === "agent" ? actor.connectionId : actor.userId;
  return safeEqual(sig, await hmacHex(config.secret, `${principal}|${action}|${targetId}|${exp}`));
}

/**
 * Gate an operation. Dashboard users confirm in the UI, so only agents are gated.
 * Throws CONFIRMATION_REQUIRED (with a token) or VALIDATION (bad/expired token).
 */
export async function requireConfirmation(
  actor: Actor,
  opts: { action: string; targetId: string; summary: string; token?: string; required: boolean },
) {
  if (actor.kind !== "agent" || !opts.required) return;
  if (!opts.token) await issueConfirmation(actor, opts.action, opts.targetId, opts.summary);
  if (!(await verifyConfirmation(actor, opts.action, opts.targetId, opts.token!))) {
    throw new AppError("VALIDATION", "Confirmation token is invalid or expired. Call again without confirmation_token to get a new one.");
  }
}
