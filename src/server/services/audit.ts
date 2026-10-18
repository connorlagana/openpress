import type { Tx } from "@/db/client";
import { auditLogs } from "@/db/schema";
import type { Actor } from "../actor";

export async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  opts: { siteId?: string | null; targetType?: string; targetId?: string; metadata?: Record<string, unknown> } = {},
) {
  await tx.insert(auditLogs).values({
    userId: actor.userId,
    siteId: opts.siteId ?? null,
    connectionId: actor.kind === "agent" ? actor.connectionId : null,
    via: actor.kind === "agent" ? `agent:${actor.clientName}` : "dashboard",
    action,
    targetType: opts.targetType,
    targetId: opts.targetId,
    metadata: opts.metadata ?? {},
    ip: actor.ip ?? null,
  });
}
