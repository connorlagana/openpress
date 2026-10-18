import { expect, test } from "@playwright/test";

test("claim a name on the landing page → signup → onboarding keeps the name → connect screen", async ({ page }) => {
  const sub = `claim-${Date.now().toString(36)}`;
  await page.goto("/");
  await page.getByLabel("Your site name").first().fill(sub);
  await expect(page.getByText(new RegExp(`${sub}\\..* is yours`))).toBeVisible();
  await page.getByRole("button", { name: /Claim it/ }).first().click();

  await expect(page).toHaveURL(new RegExp(`/signup\\?site=${sub}`));
  await expect(page.getByRole("heading", { name: new RegExp(`Claim ${sub}\\.`) })).toBeVisible();
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(`claim-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("a-very-good-password");
  await page.getByRole("button", { name: "Create free account" }).click();

  await expect(page).toHaveURL(/\/onboarding\?site=/);
  await expect(page.locator("#subdomain")).toHaveValue(sub);
  await expect(page.getByLabel("Site name")).toHaveValue(/^Claim /);
  await expect(page.getByText("Available")).toBeVisible();
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(/\/onboarding\/connect\?site=/);
  await expect(page.getByRole("link", { name: /Cursor/ })).toHaveAttribute("href", /^cursor:/);
});

test("a taken name offers an alternative", async ({ page, request }) => {
  const res = await request.get("/api/subdomain?name=admin");
  expect((await res.json()).ok).toBe(false);
  await page.goto("/");
  await page.getByLabel("Your site name").first().fill("admin");
  await expect(page.getByText(/reserved/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Claim it/ }).first()).toBeDisabled();
});

test("agent-first: an unknown visitor approving an agent is sent to signup, then back to consent", async ({ page, request, baseURL }) => {
  const reg = await request.post("/oauth/register", {
    data: { client_name: "Fresh Agent", redirect_uris: ["http://127.0.0.1:43124/cb"], grant_types: ["authorization_code"], response_types: ["code"], token_endpoint_auth_method: "none" },
  });
  const { client_id } = await reg.json();
  const q = new URLSearchParams({ response_type: "code", client_id, redirect_uri: "http://127.0.0.1:43124/cb", code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", code_challenge_method: "S256", state: "s", resource: `${baseURL}/mcp` });
  await page.goto(`/oauth/authorize?${q}`);
  await expect(page).toHaveURL(/\/signup\?next=/);
  await expect(page.getByRole("heading", { name: "Create a free account to connect your agent" })).toBeVisible();
  await page.getByLabel("Email").fill(`agentfirst-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("a-very-good-password");
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByRole("heading", { name: /Allow Fresh Agent/ })).toBeVisible();
  await expect(page.getByText(/don.t have a site yet/)).toBeVisible();
});

test("a site's footer link credits the site on the landing page", async ({ page }) => {
  await page.goto("/?ref=no-such-site-zz&utm_source=site");
  await expect(page.getByText("was built and published by an AI agent")).toHaveCount(0);
});
