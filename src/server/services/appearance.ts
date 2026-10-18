import { eq } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "@/db/client";
import { sites, themes } from "@/db/schema";
import { resolveTheme, themePatchSchema } from "@/lib/theme";
import { TEMPLATES, getTemplate, parseSettings, templateIdSchema } from "@/templates/registry";
import { requireScope, type Actor } from "../actor";
import { audit } from "./audit";
import { loadSite } from "./sites";

export function listTemplates() {
  return Object.values(TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    bestFor: t.bestFor,
    defaultTheme: t.theme,
  }));
}

export const setTemplateInput = z.object({
  siteId: z.string(),
  templateId: templateIdSchema,
  resetTheme: z.boolean().default(true).describe("Replace the theme with the template's defaults (recommended). If false, current colors/fonts are kept."),
});

export async function setTemplate(actor: Actor, input: z.input<typeof setTemplateInput>) {
  requireScope(actor, "sites:write");
  const data = setTemplateInput.parse(input);
  const template = getTemplate(data.templateId);
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, data.siteId);
    // Seed template-specific homepage blocks without overwriting what the site already has.
    const settings = { ...template.settings(site.name), ...parseSettings(site.settings) };
    await tx.update(sites).set({ template: template.id, settings, updatedAt: new Date() }).where(eq(sites.id, site.id));
    const [current] = await tx.select().from(themes).where(eq(themes.siteId, site.id));
    const tokens = data.resetTheme ? template.theme : resolveTheme(template.theme, current?.tokens);
    await tx
      .insert(themes)
      .values({ siteId: site.id, tokens })
      .onConflictDoUpdate({ target: themes.siteId, set: { tokens, updatedAt: new Date() } });
    await audit(tx, actor, "site.set_template", { siteId: site.id, targetType: "site", targetId: site.id, metadata: { template: template.id } });
    return { siteId: site.id, template: template.id, theme: tokens };
  });
}

export const updateThemeInput = z.object({ siteId: z.string(), theme: themePatchSchema });

export async function updateTheme(actor: Actor, input: z.input<typeof updateThemeInput>) {
  requireScope(actor, "sites:write");
  const data = updateThemeInput.parse(input);
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, data.siteId);
    const [current] = await tx.select().from(themes).where(eq(themes.siteId, site.id));
    const tokens = resolveTheme(getTemplate(site.template).theme, { ...((current?.tokens as object) ?? {}), ...data.theme });
    await tx
      .insert(themes)
      .values({ siteId: site.id, tokens })
      .onConflictDoUpdate({ target: themes.siteId, set: { tokens, updatedAt: new Date() } });
    await audit(tx, actor, "site.update_theme", { siteId: site.id, targetType: "site", targetId: site.id, metadata: { keys: Object.keys(data.theme) } });
    return { siteId: site.id, template: site.template, theme: tokens };
  });
}
