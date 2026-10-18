import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { expect, type Page } from "@playwright/test";

const CALLBACK = "http://127.0.0.1:43123/callback";

export class BrowserProvider implements OAuthClientProvider {
  info?: OAuthClientInformationMixed;
  tok?: OAuthTokens;
  verifier = "";
  authUrl?: URL;
  redirectUrl = CALLBACK;
  clientMetadata = { client_name: "E2E Agent", redirect_uris: [CALLBACK], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
  clientInformation = () => this.info;
  saveClientInformation = (i: OAuthClientInformationMixed) => void (this.info = i);
  tokens = () => this.tok;
  saveTokens = (t: OAuthTokens) => void (this.tok = t);
  redirectToAuthorization = (u: URL) => void (this.authUrl = u);
  saveCodeVerifier = (v: string) => void (this.verifier = v);
  codeVerifier = () => this.verifier;
}

export async function signUpAndCreateSite(page: Page, opts: { siteName: string; subdomain: string; template?: "Editorial" | "Launch" | "Portfolio" }) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(`e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`);
  await page.getByLabel("Password").fill("a-very-good-password");
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Site name").fill(opts.siteName);
  await page.locator("#subdomain").fill(opts.subdomain);
  if (opts.template) await page.getByText(opts.template, { exact: true }).click();
  await expect(page.getByText("Available")).toBeVisible();
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(/\/onboarding\/connect\?site=/);
}

/** Run the real OAuth flow: SDK client discovers + registers, the signed-in browser approves. */
export async function connectAgent(page: Page, mcpUrl: string) {
  const provider = new BrowserProvider();
  const client = new Client({ name: "e2e-agent", version: "1.0.0" });
  await expect(client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider }))).rejects.toBeInstanceOf(UnauthorizedError);
  await page.route("http://127.0.0.1:43123/**", (route) => route.fulfill({ status: 200, body: "ok" }));
  await page.goto(provider.authUrl!.toString());
  await expect(page.getByRole("heading", { name: /Allow E2E Agent/ })).toBeVisible();
  await page.getByRole("button", { name: "Allow access" }).click();
  await page.waitForURL(/127\.0\.0\.1:43123\/callback/);
  const code = new URL(page.url()).searchParams.get("code")!;
  await new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider }).finishAuth(code);
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider }));
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    (await client.callTool({ name, arguments: args })) as { isError?: boolean; structuredContent?: Record<string, any>; content: { text?: string }[] };
  return { client, provider, call };
}
