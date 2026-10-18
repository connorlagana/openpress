import { forbidden } from "@/lib/errors";

export const SCOPES = {
  "sites:read": "Read your sites, posts, pages and media",
  "sites:write": "Create sites and change settings, navigation, templates and themes",
  "content:write": "Create and edit drafts, pages and media",
  "content:publish": "Publish and unpublish posts and pages",
  "analytics:read": "Read site analytics",
  "sites:delete": "Delete sites (always requires confirmation)",
} as const;
export type Scope = keyof typeof SCOPES;
export const ALL_SCOPES = Object.keys(SCOPES) as Scope[];
export const DEFAULT_AGENT_SCOPES: Scope[] = ["sites:read", "sites:write", "content:write", "content:publish", "analytics:read"];

export function parseScopes(input: string | string[] | null | undefined): Scope[] {
  const list = Array.isArray(input) ? input : (input ?? "").split(/\s+/);
  return list.filter((s): s is Scope => s in SCOPES);
}

/**
 * Who is performing an operation. Services take an Actor and enforce scopes and
 * site restrictions themselves; RLS enforces tenant membership underneath.
 */
export type Actor =
  | { kind: "user"; userId: string; ip?: string | null }
  | {
      kind: "agent";
      userId: string;
      connectionId: string;
      clientName: string;
      scopes: ReadonlySet<Scope>;
      /** "all" = every site the user can access, including ones created later. */
      siteIds: ReadonlySet<string> | "all";
      confirmPublish: boolean;
      ip?: string | null;
    };

export function requireScope(actor: Actor, scope: Scope) {
  if (actor.kind === "agent" && !actor.scopes.has(scope)) {
    throw forbidden(`This agent connection lacks the "${scope}" permission. The account owner can grant it in Dashboard → Agents.`);
  }
}

export function assertSiteAllowed(actor: Actor, siteId: string) {
  if (actor.kind === "agent" && actor.siteIds !== "all" && !actor.siteIds.has(siteId)) {
    throw forbidden("This agent connection is not authorized for that site. The account owner can grant access in Dashboard → Agents.");
  }
}

export function siteAllowed(actor: Actor, siteId: string) {
  return actor.kind !== "agent" || actor.siteIds === "all" || actor.siteIds.has(siteId);
}
