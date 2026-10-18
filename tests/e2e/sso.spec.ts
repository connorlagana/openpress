import { expect, test } from "@playwright/test";

const shot = (name: string) => (process.env.SCREENSHOT_DIR ? { path: `${process.env.SCREENSHOT_DIR}/${name}.png`, fullPage: true } : undefined);

test("Google and Apple buttons start the provider flow with a flow cookie", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Apple" })).toBeVisible();
  const s = shot("sso-login");
  if (s) await page.screenshot(s);

  const g = await page.request.get("/auth/google/start?next=/dashboard", { maxRedirects: 0 });
  expect(g.status()).toBe(303);
  const gUrl = new URL(g.headers().location);
  expect(gUrl.origin).toBe("https://accounts.google.com");
  expect(gUrl.searchParams.get("client_id")).toBe("e2e-google-client");
  expect(gUrl.searchParams.get("redirect_uri")).toMatch(/\/auth\/google\/callback$/);
  expect(g.headers()["set-cookie"]).toMatch(/op_sso=.+HttpOnly/i);

  const a = await page.request.get("/auth/apple/start", { maxRedirects: 0 });
  const aUrl = new URL(a.headers().location);
  expect(aUrl.origin).toBe("https://appleid.apple.com");
  expect(aUrl.searchParams.get("response_mode")).toBe("form_post");

  expect((await page.request.get("/auth/github/start", { maxRedirects: 0 })).status()).toBe(404);
});

test("a forged or cancelled callback lands back on sign-in", async ({ page }) => {
  await page.goto("/auth/google/callback?code=x&state=forged");
  await expect(page).toHaveURL(/\/login\?error=invalid_state/);
  await expect(page.locator("main").getByRole("alert")).toHaveText(/sign-in link expired/);

  await page.goto("/auth/google/callback?error=access_denied");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);

  const apple = await page.request.post("/auth/apple/callback", { form: { code: "x", state: "forged" }, maxRedirects: 0 });
  expect(apple.status()).toBe(303);
  expect(apple.headers().location).toMatch(/\/login\?error=invalid_state$/);
});

test("connecting an agent offers Google and Apple, returning to consent", async ({ page, request, baseURL }) => {
  const reg = await request.post("/oauth/register", { data: { client_name: "SSO Agent", redirect_uris: ["http://127.0.0.1:43125/cb"] } });
  const { client_id } = await reg.json();
  const q = new URLSearchParams({ response_type: "code", client_id, redirect_uri: "http://127.0.0.1:43125/cb", code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", code_challenge_method: "S256", state: "s", resource: `${baseURL}/mcp` });
  await page.goto(`/oauth/authorize?${q}`);
  const google = page.getByRole("link", { name: "Continue with Google" });
  await expect(google).toHaveAttribute("href", `/auth/google/start?next=${encodeURIComponent(`/oauth/authorize?${q}`)}`);
  const s = shot("sso-authorize");
  if (s) await page.screenshot(s);
});

test("account page offers to connect sign-in methods", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`sso-acct-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("a-very-good-password");
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.goto("/dashboard/account");
  await expect(page.getByRole("link", { name: "Connect Google" })).toHaveAttribute("href", "/auth/google/start?next=%2Fdashboard%2Faccount&link=1");
  await expect(page.getByRole("link", { name: "Connect Apple" })).toBeVisible();
  const s = shot("sso-account");
  if (s) await page.screenshot(s);
});
