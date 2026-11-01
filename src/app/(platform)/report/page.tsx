import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageIntro, PublicShell } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { config } from "@/lib/config";
import { clientIp } from "@/server/auth/session";
import { submitAbuseReport } from "@/server/services/abuse";
import { rateLimit } from "@/server/services/ratelimit";

export const metadata: Metadata = { title: "Report abuse" };

async function report(form: FormData) {
  "use server";
  if (form.get("website")) redirect("/report?sent=1");
  await rateLimit(`abuse:ip:${clientIp(await headers()) ?? "unknown"}`, 10, 3600);
  await submitAbuseReport({
    url: String(form.get("url") ?? ""),
    reason: String(form.get("reason") ?? "other") as "other",
    details: String(form.get("details") ?? ""),
    reporterEmail: String(form.get("email") ?? ""),
  });
  redirect("/report?sent=1");
}

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const sent = (await searchParams).sent;
  return (
    <PublicShell>
      <main className="mx-auto max-w-lg px-6 pt-14 pb-24">
        <PageIntro kicker="Trust & safety" title="Report a site">
          Spam, phishing, malware or anything illegal hosted on {config.appName}.
        </PageIntro>
        {sent ? (
          <p className="op-card mt-8 p-6 text-sm">Thanks. Our team reviews every report.</p>
        ) : (
          <form action={report} className="op-card mt-8 space-y-4 p-6 sm:p-8">
            <div className="space-y-1.5">
              <Label htmlFor="url">URL</Label>
              <Input id="url" name="url" type="url" required placeholder={`https://example.${config.rootDomain}/…`} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <select id="reason" name="reason" className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                {["spam", "phishing", "malware", "illegal", "harassment", "other"].map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="details">Details</Label>
              <Textarea id="details" name="details" rows={4} maxLength={2000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Your email (optional)</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <input name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
            <Button type="submit" className="h-11 w-full rounded-xl text-[15px]">
              Send report
            </Button>
          </form>
        )}
      </main>
    </PublicShell>
  );
}
