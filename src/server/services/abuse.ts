import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { abuseReports, sites } from "@/db/schema";
import { config } from "@/lib/config";

export const abuseReportInput = z.object({
  url: z.string().trim().url().max(500),
  reason: z.enum(["spam", "phishing", "malware", "illegal", "harassment", "other"]),
  details: z.string().trim().max(2000).optional(),
  reporterEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
});

/** Public, unauthenticated. Resolves the site from the reported URL when it's one of ours. */
export async function submitAbuseReport(input: z.input<typeof abuseReportInput>) {
  const data = abuseReportInput.parse(input);
  const host = new URL(data.url).hostname;
  const root = config.rootDomain.split(":")[0];
  const sub = host.endsWith(`.${root}`) ? host.slice(0, -(root.length + 1)) : null;
  const db = await getDb();
  const [site] = sub ? await db.select({ id: sites.id }).from(sites).where(and(eq(sites.subdomain, sub), isNull(sites.deletedAt))) : [];
  await db.insert(abuseReports).values({ siteId: site?.id ?? null, url: data.url, reason: data.reason, details: data.details, reporterEmail: data.reporterEmail || null });
}
