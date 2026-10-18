// Operator tooling for abuse handling. Runs with the privileged connection.
//   pnpm admin reports                      list open abuse reports
//   pnpm admin suspend-site <subdomain> "<reason>"
//   pnpm admin unsuspend-site <subdomain>
//   pnpm admin suspend-user <email> "<reason>"   (also revokes agent access + sessions)
//   pnpm admin unsuspend-user <email>
//   pnpm admin resolve-report <id> actioned|dismissed
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { abuseReports, agentConnections, agentTokens, sessions, sites, users } from "../src/db/schema";

const [cmd, arg, extra] = process.argv.slice(2);
const db = await getDb();

async function userByEmail(email: string) {
  const [u] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase()));
  if (!u) throw new Error(`No user ${email}`);
  return u;
}

switch (cmd) {
  case "reports": {
    const rows = await db
      .select({ id: abuseReports.id, url: abuseReports.url, reason: abuseReports.reason, details: abuseReports.details, createdAt: abuseReports.createdAt, subdomain: sites.subdomain })
      .from(abuseReports)
      .leftJoin(sites, eq(abuseReports.siteId, sites.id))
      .where(eq(abuseReports.status, "open"));
    console.table(rows);
    break;
  }
  case "suspend-site":
  case "unsuspend-site": {
    const on = cmd === "suspend-site";
    const r = await db
      .update(sites)
      .set({ suspendedAt: on ? new Date() : null, suspensionReason: on ? (extra ?? "policy violation") : null })
      .where(and(eq(sites.subdomain, arg), isNull(sites.deletedAt)))
      .returning({ id: sites.id });
    console.log(r.length ? `${cmd}: ${arg}` : `No live site ${arg}`);
    break;
  }
  case "suspend-user":
  case "unsuspend-user": {
    const on = cmd === "suspend-user";
    const u = await userByEmail(arg);
    await db.update(users).set({ suspendedAt: on ? new Date() : null, suspensionReason: on ? (extra ?? "policy violation") : null }).where(eq(users.id, u.id));
    if (on) {
      await db.delete(sessions).where(eq(sessions.userId, u.id));
      const conns = await db.update(agentConnections).set({ revokedAt: new Date() }).where(and(eq(agentConnections.userId, u.id), isNull(agentConnections.revokedAt))).returning({ id: agentConnections.id });
      for (const c of conns) await db.update(agentTokens).set({ revokedAt: new Date() }).where(eq(agentTokens.connectionId, c.id));
    }
    console.log(`${cmd}: ${u.email}`);
    break;
  }
  case "resolve-report": {
    await db.update(abuseReports).set({ status: extra === "actioned" ? "actioned" : "dismissed" }).where(eq(abuseReports.id, arg));
    console.log("ok");
    break;
  }
  default:
    console.log("commands: reports | suspend-site | unsuspend-site | suspend-user | unsuspend-user | resolve-report");
}
process.exit(0);
