import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "@/db/client";
import { agentConnectionSites, agentConnections, agentTokens, auditLogs, oauthClients, sites } from "@/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { ALL_SCOPES, type Actor, type Scope } from "../actor";
import { audit } from "./audit";

/** Dashboard-only: agents cannot manage their own permissions. */
function assertHuman(actor: Actor) {
  if (actor.kind !== "user") throw new AppError("FORBIDDEN", "Agent connections can only be managed from the dashboard.");
}

export async function listConnections(actor: Actor) {
  assertHuman(actor);
  return withUser(actor.userId, async (tx) => {
    const rows = await tx
      .select({ c: agentConnections, clientName: oauthClients.name, clientUri: oauthClients.clientUri })
      .from(agentConnections)
      .leftJoin(oauthClients, eq(agentConnections.clientId, oauthClients.id))
      .where(and(eq(agentConnections.userId, actor.userId), isNull(agentConnections.revokedAt)))
      .orderBy(desc(agentConnections.createdAt));
    const ids = rows.map((r) => r.c.id);
    const siteRows = ids.length
      ? await tx
          .select({ connectionId: agentConnectionSites.connectionId, siteId: sites.id, name: sites.name })
          .from(agentConnectionSites)
          .innerJoin(sites, eq(agentConnectionSites.siteId, sites.id))
          .where(and(inArray(agentConnectionSites.connectionId, ids), isNull(sites.deletedAt)))
      : [];
    const prefixes = ids.length
      ? await tx.select({ connectionId: agentTokens.connectionId, prefix: agentTokens.prefix }).from(agentTokens).where(and(inArray(agentTokens.connectionId, ids), eq(agentTokens.kind, "api_key")))
      : [];
    return rows.map(({ c, clientName, clientUri }) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      clientName: clientName ?? null,
      clientUri: clientUri ?? null,
      scopes: c.scopes as Scope[],
      allSites: c.allSites,
      sites: siteRows.filter((s) => s.connectionId === c.id).map((s) => ({ id: s.siteId, name: s.name })),
      confirmPublish: c.confirmPublish,
      keyPrefix: prefixes.find((p) => p.connectionId === c.id)?.prefix ?? null,
      lastUsedAt: c.lastUsedAt,
      createdAt: c.createdAt,
    }));
  });
}

export const updateConnectionInput = z.object({
  scopes: z.array(z.enum(ALL_SCOPES as [Scope, ...Scope[]])).min(1),
  allSites: z.boolean(),
  siteIds: z.array(z.string().uuid()),
  confirmPublish: z.boolean(),
});

export async function updateConnection(actor: Actor, connectionId: string, input: z.input<typeof updateConnectionInput>) {
  assertHuman(actor);
  const data = updateConnectionInput.parse(input);
  return withUser(actor.userId, async (tx) => {
    const [conn] = await tx.select().from(agentConnections).where(and(eq(agentConnections.id, connectionId), isNull(agentConnections.revokedAt)));
    if (!conn) throw notFound("Connection");
    await tx.update(agentConnections).set({ scopes: data.scopes, allSites: data.allSites, confirmPublish: data.confirmPublish }).where(eq(agentConnections.id, conn.id));
    await tx.delete(agentConnectionSites).where(eq(agentConnectionSites.connectionId, conn.id));
    if (!data.allSites && data.siteIds.length) {
      const owned = await tx.select({ id: sites.id }).from(sites).where(and(inArray(sites.id, data.siteIds), isNull(sites.deletedAt)));
      if (owned.length) await tx.insert(agentConnectionSites).values(owned.map((s) => ({ connectionId: conn.id, siteId: s.id })));
    }
    await audit(tx, actor, "agent.update_permissions", { targetType: "agent_connection", targetId: conn.id, metadata: data });
  });
}

export async function revokeConnection(actor: Actor, connectionId: string) {
  assertHuman(actor);
  return withUser(actor.userId, async (tx) => {
    const [conn] = await tx
      .update(agentConnections)
      .set({ revokedAt: new Date() })
      .where(and(eq(agentConnections.id, connectionId), isNull(agentConnections.revokedAt)))
      .returning();
    if (!conn) throw notFound("Connection");
    await tx.update(agentTokens).set({ revokedAt: new Date() }).where(and(eq(agentTokens.connectionId, conn.id), isNull(agentTokens.revokedAt)));
    await audit(tx, actor, "agent.revoke", { targetType: "agent_connection", targetId: conn.id, metadata: { name: conn.name } });
  });
}

export async function recentActivity(actor: Actor, opts: { siteId?: string; limit?: number } = {}) {
  assertHuman(actor);
  return withUser(actor.userId, (tx) =>
    tx
      .select()
      .from(auditLogs)
      .where(opts.siteId ? eq(auditLogs.siteId, opts.siteId) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(opts.limit ?? 50),
  );
}
