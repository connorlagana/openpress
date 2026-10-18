import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #1a73e8");

export const FONT_STACKS = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, Cambria, serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
  humanist: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif',
  geometric: 'Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif',
} as const;

/**
 * Structured theme tokens. Templates read only these values, so agents can
 * restyle a site without being able to inject CSS.
 */
export const themeSchema = z.object({
  primaryColor: hex.describe("Accent color for links, buttons and highlights"),
  secondaryColor: hex.describe("Secondary accent used for subtle backgrounds and hovers"),
  backgroundColor: hex.optional().describe("Page background in light mode; template default if omitted"),
  textColor: hex.optional().describe("Body text color in light mode; template default if omitted"),
  headingFont: z.enum(["sans", "serif", "mono", "humanist", "geometric"]),
  bodyFont: z.enum(["sans", "serif", "mono", "humanist", "geometric"]),
  baseFontSize: z.number().int().min(14).max(22).describe("Root font size in px"),
  headerStyle: z.enum(["simple", "centered", "split", "minimal"]),
  footerStyle: z.enum(["simple", "columns", "minimal"]),
  contentWidth: z.enum(["narrow", "medium", "wide"]),
  layout: z.enum(["single-column", "sidebar", "grid"]).describe("Post listing layout preset"),
  buttonStyle: z.enum(["rounded", "pill", "square", "outline"]),
  colorMode: z.enum(["light", "dark", "auto"]).describe("auto follows the visitor's system preference"),
});

export type Theme = z.infer<typeof themeSchema>;
export const themePatchSchema = themeSchema.partial();

export const CONTENT_WIDTH_PX = { narrow: 640, medium: 760, wide: 1100 } as const;
export const BUTTON_RADIUS = { rounded: "8px", pill: "999px", square: "0", outline: "8px" } as const;

/** Merge stored (possibly partial or stale) tokens over template defaults, dropping invalid values. */
export function resolveTheme(defaults: Theme, stored: unknown): Theme {
  const parsed = themePatchSchema.safeParse(stored ?? {});
  if (parsed.success) return { ...defaults, ...stripUndefined(parsed.data) };
  // Keep valid keys individually if some are invalid.
  const out: Theme = { ...defaults };
  if (stored && typeof stored === "object") {
    for (const [k, v] of Object.entries(stored)) {
      const field = themeSchema.shape[k as keyof Theme];
      if (field && field.safeParse(v).success) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Theme -> CSS custom properties consumed by the public site stylesheet. */
export function themeCssVars(t: Theme): Record<string, string> {
  return {
    "--fs-primary": t.primaryColor,
    "--fs-secondary": t.secondaryColor,
    ...(t.backgroundColor ? { "--fs-bg-light": t.backgroundColor } : {}),
    ...(t.textColor ? { "--fs-fg-light": t.textColor } : {}),
    "--fs-heading-font": FONT_STACKS[t.headingFont],
    "--fs-body-font": FONT_STACKS[t.bodyFont],
    "--fs-base-size": `${t.baseFontSize}px`,
    "--fs-content-width": `${CONTENT_WIDTH_PX[t.contentWidth]}px`,
    "--fs-radius": BUTTON_RADIUS[t.buttonStyle],
  };
}
