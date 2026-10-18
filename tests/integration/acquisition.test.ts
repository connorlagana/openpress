import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { createUser } from "@/server/auth/accounts";
import { onboardingStatus } from "@/server/services/agents";
import { signupFunnel } from "@/server/services/funnel";
import { createPost, setPublished } from "@/server/services/posts";
import { createSite } from "@/server/services/sites";
import { appFetch, call, connectWithApiKey, makeUser } from "../helpers";

const check = async (name: string) => (await appFetch(`${config.appUrl}/api/subdomain?name=${encodeURIComponent(name)}`)).json();

describe("acquisition funnel", () => {
  it("checks subdomain availability publicly, with a free alternative when taken", async () => {
    const { actor } = await makeUser("claim");
    await createSite(actor, { name: "Claimed", subdomain: "claimed-name", template: "editorial" });
    expect(await check("fresh-name-xyz")).toEqual({ ok: true, message: "Available" });
    expect(await check("claimed-name")).toMatchObject({ ok: false, message: "Already taken", suggestion: "claimed-name-2" });
    expect((await check("admin")).ok).toBe(false);
    expect((await check("Bad Name!")).ok).toBe(false);
  });

  it("records a well-formed signup source and drops anything else", async () => {
    const a = await createUser({ email: `src-a-${Date.now()}@example.com`, password: "correct horse battery", signupSource: "site:field-notes" });
    const b = await createUser({ email: `src-b-${Date.now()}@example.com`, password: "correct horse battery", signupSource: "<script>" });
    expect(a.signupSource).toBe("site:field-notes");
    expect(b.signupSource).toBeNull();
  });

  it("tracks onboarding: agent connects, makes a call, then the first post goes live", async () => {
    const { user, actor } = await makeUser("onboard");
    const site = await createSite(actor, { name: "Onboard", template: "editorial" });
    expect(await onboardingStatus(actor, site.id)).toEqual({ agent: null, published: null });

    // Connecting (MCP initialize) already counts as the agent's first call.
    const { client } = await connectWithApiKey(user.id);
    await call(client, "list_sites");
    expect((await onboardingStatus(actor, site.id)).agent).toMatchObject({ name: "test key", active: true });

    const post = await createPost(actor, { siteId: site.id, title: "Welcome", content: "Hi" });
    await setPublished(actor, post.id, true);
    expect((await onboardingStatus(actor, site.id)).published).toEqual({ title: "Welcome", path: "/blog/welcome" });

    // Another user can't read this site's progress.
    const other = await makeUser("nosy");
    expect((await onboardingStatus(other.actor, site.id)).published).toBeNull();

    const total = (await signupFunnel(1)).find((r) => r.source === "total")!;
    expect(total.signups).toBeGreaterThanOrEqual(3);
    expect(total.published24h).toBeGreaterThanOrEqual(1);
    expect(total.agentUsed).toBeGreaterThanOrEqual(1);
  });
});
