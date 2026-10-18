import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyButton } from "@/components/app/copy-button";
import { clientInstructions } from "@/lib/clients";
import { config } from "@/lib/config";
import { requireActor } from "@/server/auth/session";
import { mcpResourceUrl } from "@/server/oauth/oauth";
import { listSites } from "@/server/services/sites";
import { ConnectStatus, InstallButtons } from "./connect-client";

export const metadata: Metadata = { title: "Connect your agent" };

/** Step 2 of onboarding: get an agent connected and watch for its first call and first publish. */
export default async function ConnectPage({ searchParams }: PageProps<"/onboarding/connect">) {
  const actor = await requireActor();
  const siteId = (await searchParams).site;
  const site = (await listSites(actor)).find((s) => s.id === siteId);
  if (!site) redirect("/dashboard");
  const mcpUrl = mcpResourceUrl();
  const host = site.url.replace(/^https?:\/\//, "");
  const prompt = `Write a short welcome post for my ${config.appName} site "${site.name}", add a fitting image with alt text, and publish it.`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          {config.appName}
        </Link>
        <Link href={`/dashboard/sites/${site.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          Skip to dashboard →
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-[4vh] pb-20">
        <p className="font-mono text-xs text-muted-foreground">Step 2 of 2</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
          <a href={site.url} target="_blank" rel="noreferrer" className="underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground">
            {host}
          </a>{" "}
          is live. Now connect your agent.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Add this one URL to your AI client. It opens a sign-in window; approve it and you&rsquo;re done.</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-sm">{mcpUrl}</code>
          <CopyButton value={mcpUrl} label="Copy URL" />
        </div>

        <InstallButtons clients={clientInstructions(mcpUrl, config.appName)} />

        <ConnectStatus siteId={site.id} siteUrl={site.url} prompt={prompt} />
      </main>
    </div>
  );
}
