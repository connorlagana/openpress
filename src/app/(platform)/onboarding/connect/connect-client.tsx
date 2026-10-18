"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CodeBlock } from "@/components/app/copy-button";
import type { ClientInstructions } from "@/lib/clients";
import { cn } from "@/lib/utils";
import { onboardingStatusAction } from "../../dashboard/actions";
import { CopyPrompt } from "../../_landing/copy-prompt";

/** One card per client: a one-click install where the client supports it, otherwise its short steps. */
export function InstallButtons({ clients }: { clients: ClientInstructions[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const c = clients.find((x) => x.id === open);
  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {clients.map((x) =>
          x.installUrl ? (
            <a key={x.id} href={x.installUrl} className="flex h-12 border shadow-xs items-center justify-between rounded-xl bg-background px-3.5 text-sm font-medium hover:bg-muted/50">
              {x.name}
              <span className="text-xs font-normal text-muted-foreground">Install ↗</span>
            </a>
          ) : (
            <button
              key={x.id}
              type="button"
              aria-expanded={open === x.id}
              onClick={() => setOpen(open === x.id ? null : x.id)}
              className={cn("flex h-12 border shadow-xs items-center justify-between rounded-xl bg-background px-3.5 text-left text-sm font-medium hover:bg-muted/50", open === x.id && "ring-2 ring-foreground")}
            >
              {x.name}
              <span className="text-xs font-normal text-muted-foreground">How ↓</span>
            </button>
          ),
        )}
      </div>
      {c ? (
        <div className="mt-3 space-y-3 rounded-xl border p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {c.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <CodeBlock code={c.code} />
        </div>
      ) : null}
    </div>
  );
}

type Status = Awaited<ReturnType<typeof onboardingStatusAction>>;

/** Polls until the agent connects and the first post goes live, so the screen reacts while the user is in their agent. */
export function ConnectStatus({ siteId, siteUrl, prompt }: { siteId: string; siteUrl: string; prompt: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const done = !!status?.published;

  useEffect(() => {
    if (done) return;
    let alive = true;
    const poll = () =>
      onboardingStatusAction(siteId)
        .then((s) => alive && setStatus(s))
        .catch(() => {});
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [siteId, done]);

  const steps = [
    { label: status?.agent ? `${status.agent.name} connected` : "Waiting for your agent to connect…", done: !!status?.agent },
    { label: status?.published ? "First post published" : "Ask it to write your first post", done },
  ];

  return (
    <section className="mt-10 rounded-2xl border p-5" aria-live="polite">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className={cn("grid size-6 flex-none place-items-center rounded-full transition-colors", s.done ? "bg-signal text-white" : "border-2 border-border")}>
              {s.done ? <Check className="size-3.5" /> : i === 0 || steps[0].done ? <span className="size-2 animate-pulse rounded-full bg-muted-foreground" /> : null}
            </span>
            <span className={cn(s.done ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
          </li>
        ))}
      </ol>
      {status?.published ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href={`${siteUrl}${status.published.path}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80">
            Read &ldquo;{status.published.title}&rdquo; ↗
          </a>
          <Link href={`/dashboard/sites/${siteId}`} className="text-sm text-muted-foreground hover:text-foreground">
            Go to dashboard →
          </Link>
        </div>
      ) : (
        <div className={cn("mt-5 transition-opacity", status?.agent ? "opacity-100" : "opacity-60")}>
          <CopyPrompt prompt={prompt} label={status?.agent ? "Now paste this into your agent" : "Once connected, paste this into your agent"} />
        </div>
      )}
    </section>
  );
}
