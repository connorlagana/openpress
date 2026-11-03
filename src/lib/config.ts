/** Central runtime configuration. Everything here has a safe local default. */
export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "OpenPress",
  /** Host that serves the dashboard, API and MCP endpoint, e.g. openpress.blog or localhost:3000 */
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
  /** "Sign in with Google": an OAuth web client. Unset = the button is hidden. */
  get google() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  },
  /** "Sign in with Apple": a Services ID plus a Sign in with Apple key (.p8). Unset = the button is hidden. */
  get apple() {
    const clientId = process.env.APPLE_CLIENT_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    // Env files often carry the PEM on one line with literal \n.
    const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    return clientId && teamId && keyId && privateKey ? { clientId, teamId, keyId, privateKey } : null;
  },
  /**
   * Custom visualizations (agent-written HTML/CSS/JS in a sandboxed iframe).
   * OFF unless CUSTOM_VIZ=on: until the sandbox has had an independent security
   * review, no custom code is stored or executed. VIZ_SANDBOX_ORIGIN should be a
   * separate registrable domain (e.g. https://openpress-usercontent.net) routed
   * to this app; unset = the app origin (still an opaque-origin sandbox).
   */
  get customViz() {
    const origin = (process.env.VIZ_SANDBOX_ORIGIN || this.appUrl).replace(/\/+$/, "");
    return { enabled: process.env.CUSTOM_VIZ === "on", origin };
  },
  /** Sign-ups per IP per hour. Override only for test servers that sign up many accounts. */
  get signupRateLimitPerHour() {
    return Number(process.env.SIGNUP_RATE_LIMIT_PER_HOUR) || 5;
  },
  sessionTtlDays: 30,
  accessTokenTtlSeconds: 60 * 60,
  refreshTokenTtlDays: 60,
  authRateLimitPerMinute: 10,
  ipRateLimitPerMinute: 300,
  analyticsRetentionDays: 90,
};
