// Seed a demo site with every synthetic visualization (src/lib/charts/demo.ts)
// in one published post, through the same services agents use.
//   DATABASE_URL=pglite://./.data/dev pnpm demo:viz <email-of-existing-user>
// Also adds the demo custom visualization (pending approval: approve it in
// Dashboard → Visualizations to see it run).
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { sites, users } from "../src/db/schema";
import { DEMO_CHARTS, DEMO_CUSTOM_VIZ } from "../src/lib/charts/demo";
import { config } from "../src/lib/config";
import type { Actor } from "../src/server/actor";
import { createChart } from "../src/server/services/charts";
import { createCustomViz } from "../src/server/services/custom-viz";
import { createPost, setPublished } from "../src/server/services/posts";

const email = process.argv[2];
if (!email) throw new Error("Usage: pnpm demo:viz <email>");
const db = await getDb();
const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase()));
if (!user) throw new Error(`No user ${email}`);
const [site] = await db.select().from(sites).where(eq(sites.ownerId, user.id)).limit(1);
if (!site) throw new Error(`${email} has no site yet`);
const actor: Actor = { kind: "user", userId: user.id };

const parts: string[] = ["Synthetic data, generated for testing every chart type, filter and field preset."];
for (const d of DEMO_CHARTS) {
  const chart = await createChart(actor, { siteId: site.id, ...d.build() } as never);
  parts.push(`## ${chart.title}\n\n${chart.embed}`);
}
const viz = await createCustomViz(actor, { siteId: site.id, ...DEMO_CUSTOM_VIZ });
parts.push(`## Custom visualization\n\n${viz.embed}`);
console.log(`Approve the custom visualization at ${viz.approvalUrl}`);
const post = await createPost(actor, { siteId: site.id, title: "Visualization gallery", content: parts.join("\n\n") });
await setPublished(actor, post.id, true);
console.log(`Published ${config.siteUrl(site.subdomain)}/blog/${post.slug}`);
process.exit(0);
