/** Central runtime configuration. Everything here has a safe local default. */
export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Folio",
  /** Host that serves the dashboard, API and MCP endpoint, e.g. folio.site or localhost:3000 */
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000",
  /** http for localhost, https everywhere else */
  get protocol() {
    return this.rootDomain.startsWith("localhost") || this.rootDomain.includes(".localhost") ? "http" : "https";
  },
  get appUrl() {
    return `${this.protocol}://${this.rootDomain}`;
  },
  siteUrl(subdomain: string) {
    return `${this.protocol}://${subdomain}.${this.rootDomain}`;
  },
  /** Secret for HMAC (confirmation tokens, analytics salts). Must be set in production. */
  get secret() {
    const s = process.env.APP_SECRET;
    if (!s && process.env.NODE_ENV === "production") throw new Error("APP_SECRET is required in production");
    return s ?? "dev-insecure-secret-change-me";
  },
  sessionTtlDays: 30,
  accessTokenTtlSeconds: 60 * 60,
  refreshTokenTtlDays: 60,
  authRateLimitPerMinute: 10,
  ipRateLimitPerMinute: 300,
  analyticsRetentionDays: 90,
};
