import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader, Section, formatBytes, relativeTime } from "@/components/app/bits";
import { SsoButtons } from "@/components/app/sso-buttons";
import { withUser } from "@/db/client";
import { userIdentities } from "@/db/schema";
import { requireActor, requireUser } from "@/server/auth/session";
import { enabledSsoProviders, SSO_ERROR_MESSAGES, type SsoProvider } from "@/server/auth/sso";
import { recentActivity } from "@/server/services/agents";
import { usageSummary } from "@/server/services/limits";
import { PasswordForm, ProfileForm } from "./account-client";

export const metadata: Metadata = { title: "Account" };

function Meter({ label, used, limit, format = (n: number) => n.toLocaleString() }: { label: string; used: number; limit: number; format?: (n: number) => string }) {
  const pct = Math.min(100, (used / Math.max(1, limit)) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {format(used)} / {format(limit)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={label}>
        <div className={pct > 90 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-foreground"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const PROVIDER_LABELS: Record<SsoProvider, string> = { google: "Google", apple: "Apple" };

export default async function AccountPage({ searchParams }: PageProps<"/dashboard/account">) {
  const user = await requireUser();
  const actor = await requireActor();
  const [usage, activity, identities] = await Promise.all([
    withUser(user.id, (tx) => usageSummary(tx, user.id)),
    recentActivity(actor, { limit: 30 }),
    withUser(user.id, (tx) => tx.select({ provider: userIdentities.provider, email: userIdentities.email }).from(userIdentities).where(eq(userIdentities.userId, user.id))),
  ]);
  const { error } = await searchParams;
  const ssoError = typeof error === "string" && error in SSO_ERROR_MESSAGES ? SSO_ERROR_MESSAGES[error as keyof typeof SSO_ERROR_MESSAGES] : null;
  const showSignInMethods = identities.length > 0 || enabledSsoProviders().length > 0;
  return (
    <>
      <PageHeader title="Account" description={user.email} />
      <Section title="Plan & usage" description={`${usage.plan.name} — free forever. MCP access is always free.`}>
        <div className="grid max-w-xl gap-5">
          <Meter label="Sites" used={usage.sites.used} limit={usage.sites.limit} />
          <Meter label="Storage" used={usage.storageBytes.used} limit={usage.storageBytes.limit} format={formatBytes} />
          <Meter label="Pageviews this month" used={usage.pageviewsThisMonth.used} limit={usage.pageviewsThisMonth.limit} />
          <p className="text-xs text-muted-foreground">
            Uploads up to {formatBytes(usage.maxUploadBytes)} each · {usage.mcpRequestsPerMinute} agent requests per minute
          </p>
        </div>
      </Section>
      <Section title="Profile">
        <ProfileForm name={user.name ?? ""} />
      </Section>
      {showSignInMethods ? (
        <Section title="Sign-in methods" description="Sign in with any of these. Connecting one doesn't change your email.">
          <div className="max-w-xl space-y-4">
            {ssoError ? (
              <p role="alert" className="text-sm text-destructive">
                {ssoError}
              </p>
            ) : null}
            {identities.length ? (
              <ul className="divide-y rounded-xl border text-sm">
                {identities.map((i) => (
                  <li key={i.provider} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span>{PROVIDER_LABELS[i.provider]}</span>
                    <span className="truncate text-muted-foreground">{i.email ?? "Connected"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <SsoButtons link next="/dashboard/account" connected={identities.map((i) => i.provider)} divider={false} />
          </div>
        </Section>
      ) : null}
      <Section
        title="Password"
        description={
          user.passwordHash
            ? "Changing it signs out your other browser sessions. Agent connections are not affected."
            : "You sign in with Google or Apple. Set a password to also sign in with your email."
        }
      >
        <PasswordForm hasPassword={!!user.passwordHash} />
      </Section>
      <Section title="Recent activity" description="Publishing, deletions and permission changes, by you or your agents.">
        {activity.length ? (
          <ul className="divide-y rounded-xl border text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="font-mono text-xs">{a.action}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{typeof (a.metadata as { title?: string }).title === "string" ? (a.metadata as { title: string }).title : ""}</span>
                <span className="text-xs text-muted-foreground">{a.via}</span>
                <span className="w-20 text-right text-xs text-muted-foreground">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        )}
      </Section>
    </>
  );
}
