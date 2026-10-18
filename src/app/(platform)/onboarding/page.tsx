import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { requireActor } from "@/server/auth/session";
import { listTemplates } from "@/server/services/appearance";
import { listSites } from "@/server/services/sites";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Create your site" };

export default async function OnboardingPage() {
  const actor = await requireActor();
  if ((await listSites(actor)).length) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          {config.appName}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-[4vh] pb-20">
        <p className="font-mono text-xs text-muted-foreground">Step 1 of 2</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Name your site</h1>
        <p className="mt-1 text-sm text-muted-foreground">You can change everything later, or ask your agent to.</p>
        <OnboardingForm rootDomain={config.rootDomain} templates={listTemplates().map(({ id, name, description }) => ({ id, name, description }))} />
      </main>
    </div>
  );
}
