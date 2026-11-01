"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

type Check = { ok: boolean; message: string; suggestion?: string; name: string };

const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);

/** "yourname.openpress.blog" box: live availability, then on to signup (or onboarding) with the name carried along. */
export function ClaimName({ rootDomain, signedIn, className }: { rootDomain: string; signedIn: boolean; className?: string }) {
  const id = useId();
  const [name, setName] = useState("");
  const [check, setCheck] = useState<Check | null>(null);

  useEffect(() => {
    if (name.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/subdomain?name=${encodeURIComponent(name)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((r) => r && setCheck({ ...r, name }))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [name]);

  const status = check?.name === name && name.length >= 3 ? check : null;
  const router = useRouter();
  const go = (sub: string) => router.push(`${signedIn ? "/onboarding" : "/signup"}?site=${encodeURIComponent(sub)}`);

  return (
    <form
      className={cn("w-full max-w-[34rem]", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.length >= 3 && status?.ok !== false) go(name);
      }}
    >
      <div className="lp-claim lp-shadow">
        <label htmlFor={`${id}-claim`} className="sr-only">
          Your site name
        </label>
        <div className="lp-claim__field">
          <input id={`${id}-claim`} value={name} onChange={(e) => setName(clean(e.target.value))} placeholder="yourname" autoComplete="off" spellCheck={false} aria-describedby={`${id}-status`} />
          <span aria-hidden>.{rootDomain}</span>
        </div>
        <button type="submit" className="lp-cta" disabled={status?.ok === false}>
          Claim it <span className="lp-cta__arrow">→</span>
        </button>
      </div>
      <p id={`${id}-status`} aria-live="polite" className={cn("lp-claim__status mt-2 min-h-5 pl-1 text-[13px]", status?.ok ? "text-signal" : status ? "text-destructive" : "text-muted-foreground")}>
        {status?.ok ? (
          <>✓ {name}.{rootDomain} is yours if you want it. Free, no card.</>
        ) : status ? (
          <>
            {status.message}
            {status.suggestion ? (
              <>
                {" · "}
                <button type="button" className="underline underline-offset-2" onClick={() => setName(status.suggestion!)}>
                  try {status.suggestion}
                </button>
              </>
            ) : null}
          </>
        ) : (
          "Pick your free address. Free forever, no card."
        )}
      </p>
    </form>
  );
}
