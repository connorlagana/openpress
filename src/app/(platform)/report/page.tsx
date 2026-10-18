import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
    <main className="mx-auto max-w-lg px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← {config.appName}
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Report a site</h1>
      {sent ? (
        <p className="mt-4 text-sm">Thanks. Our team reviews every report.</p>
      ) : (
        <form action={report} className="mt-6 space-y-4">
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
          <Button type="submit">Send report</Button>
        </form>
      )}
    </main>
  );
}
