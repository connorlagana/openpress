import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Plans hold every free-tier limit so paid plans later are rows, not code.
export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  maxSites: integer("max_sites").notNull(),
  maxStorageBytes: bigint("max_storage_bytes", { mode: "number" }).notNull(),
  maxUploadBytes: integer("max_upload_bytes").notNull(),
  maxPostsPerSite: integer("max_posts_per_site").notNull(),
  mcpRequestsPerMinute: integer("mcp_requests_per_minute").notNull(),
  monthlyPageviews: integer("monthly_pageviews").notNull(),
  customDomains: boolean("custom_domains").notNull().default(false),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    planId: text("plan_id").notNull().default("free").references(() => plans.id),
    isAdmin: boolean("is_admin").notNull().default(false),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie token; the raw token is never stored.
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subdomain: text("subdomain").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    template: text("template").notNull().default("editorial"),
    language: text("language").notNull().default("en"),
    logoMediaId: uuid("logo_media_id"),
    faviconMediaId: uuid("favicon_media_id"),
    // Structured, schema-validated content blocks (hero, features, social links, footer text).
    settings: jsonb("settings").notNull().default({}),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("sites_subdomain_live_key").on(t.subdomain).where(sql`${t.deletedAt} is null`),
    index("sites_owner_idx").on(t.ownerId),
  ],
);

export const siteMembers = pgTable(
  "site_members",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "editor"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.userId] }), index("site_members_user_idx").on(t.userId)],
);

export const themes = pgTable("themes", {
  siteId: uuid("site_id").primaryKey().references(() => sites.id, { onDelete: "cascade" }),
  tokens: jsonb("tokens").notNull().default({}),
  updatedAt: updatedAt(),
});

export const navItems = pgTable(
  "nav_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    location: text("location", { enum: ["header", "footer"] }).notNull(),
    label: text("label").notNull(),
    href: text("href").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("nav_items_site_idx").on(t.siteId, t.location, t.position)],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text"),
    sourceUrl: text("source_url"),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("media_site_idx").on(t.siteId, t.createdAt), uniqueIndex("media_storage_key").on(t.storageKey)],
);

// Posts and static pages share one table (kind) because they share every
// lifecycle concern: drafts, publishing, SEO, revisions, redirects.
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["post", "page"] }).notNull().default("post"),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    contentMd: text("content_md").notNull().default(""),
    contentHtml: text("content_html").notNull().default(""),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    coverMediaId: uuid("cover_media_id").references(() => media.id, { onDelete: "set null" }),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    authorName: text("author_name"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogImageUrl: text("og_image_url"),
    canonicalUrl: text("canonical_url"),
    noindex: boolean("noindex").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdVia: text("created_via", { enum: ["dashboard", "agent"] }).notNull().default("dashboard"),
    agentConnectionId: uuid("agent_connection_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("posts_site_kind_slug_live_key").on(t.siteId, t.kind, t.slug).where(sql`${t.deletedAt} is null`),
    index("posts_site_status_idx").on(t.siteId, t.kind, t.status, t.publishedAt),
  ],
);

export const postRevisions = pgTable(
  "post_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    contentMd: text("content_md").notNull(),
    createdBy: uuid("created_by"),
    createdVia: text("created_via").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("post_revisions_post_idx").on(t.postId, t.createdAt)],
);

// 301s recorded when a published URL changes.
export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("redirects_site_from_key").on(t.siteId, t.fromPath)],
);

// Dynamically registered OAuth clients (RFC 7591). Public clients only (PKCE).
export const oauthClients = pgTable("oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  redirectUris: text("redirect_uris").array().notNull(),
  clientUri: text("client_uri"),
  createdAt: createdAt(),
});

// An agent connection is the user's grant: which client, which scopes, which sites.
export const agentConnections = pgTable(
  "agent_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => oauthClients.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["oauth", "api_key"] }).notNull(),
    name: text("name").notNull(),
    scopes: text("scopes").array().notNull(),
    allSites: boolean("all_sites").notNull().default(false),
    confirmPublish: boolean("confirm_publish").notNull().default(false),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("agent_connections_user_idx").on(t.userId)],
);

export const agentConnectionSites = pgTable(
  "agent_connection_sites",
  {
    connectionId: uuid("connection_id").notNull().references(() => agentConnections.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.connectionId, t.siteId] })],
);

export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  connectionId: uuid("connection_id").notNull().references(() => agentConnections.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  resource: text("resource"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// Access tokens, refresh tokens, and API keys. Only hashes are stored.
export const agentTokens = pgTable(
  "agent_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    connectionId: uuid("connection_id").notNull().references(() => agentConnections.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["access", "refresh", "api_key"] }).notNull(),
    prefix: text("prefix"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("agent_tokens_connection_idx").on(t.connectionId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id"),
    siteId: uuid("site_id"),
    connectionId: uuid("connection_id"),
    via: text("via").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_user_idx").on(t.userId, t.createdAt), index("audit_logs_site_idx").on(t.siteId, t.createdAt)],
);

// Fixed-window counters for rate limiting (per user, per IP, per token).
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

// Privacy-preserving analytics: no cookies, no raw IPs. visitor_hash is
// sha256(daily_salt + site + ip + ua), so it cannot be linked across days.
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    visitorHash: text("visitor_hash").notNull(),
    referrerHost: text("referrer_host"),
    referrerCategory: text("referrer_category").notNull(),
    day: date("day").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_site_day_idx").on(t.siteId, t.day)],
);

export const abuseReports = pgTable("abuse_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  reason: text("reason", { enum: ["spam", "phishing", "malware", "illegal", "harassment", "other"] }).notNull(),
  details: text("details"),
  reporterEmail: text("reporter_email"),
  status: text("status", { enum: ["open", "actioned", "dismissed"] }).notNull().default("open"),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Media = typeof media.$inferSelect;
export type NavItem = typeof navItems.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type AgentConnection = typeof agentConnections.$inferSelect;
