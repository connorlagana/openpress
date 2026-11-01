import type { Metadata } from "next";
import { Logo, PageIntro } from "@/components/app/brand";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { SUBDOMAIN_RE } from "@/lib/slug";
import { requireActor } from "@/server/auth/session";
import { listTemplates } from "@/server/services/appearance";
import { listSites } from "@/server/services/sites";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Create your site" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const actor = await requireActor();
  const claimed = (await searchParams).site;
  if ((await listSites(actor)).length) redirect("/dashboard");
  return (
    <div className="op-canvas flex min-h-screen flex-col">
      <header className="flex h-14 items-center px-6 text-sm">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-[6vh] pb-20">
        <PageIntro kicker="Step 1 of 2" title="Name your site">
          You can change everything later, or ask your agent to.
        </PageIntro>
        <OnboardingForm claimed={typeof claimed === "string" && SUBDOMAIN_RE.test(claimed) ? claimed : undefined} rootDomain={config.rootDomain} templates={listTemplates().map(({ id, name, description }) => ({ id, name, description }))} />
      </main>
    </div>
  );
}
