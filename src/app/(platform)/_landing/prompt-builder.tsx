"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyPrompt } from "./copy-prompt";

const KINDS = [
  { id: "blog", label: "A blog", template: "editorial", noun: "blog" },
  { id: "company", label: "A company or product site", template: "saas", noun: "website" },
  { id: "portfolio", label: "A portfolio", template: "portfolio", noun: "portfolio" },
  { id: "personal", label: "A personal homepage", template: "portfolio", noun: "personal site" },
] as const;

const STYLES = [
  { id: "minimal", label: "Minimal and quiet", text: "Keep the design minimal: plenty of whitespace and a restrained accent color" },
  { id: "bold", label: "Bold and modern", text: "Make the design bold and modern: strong sans-serif headings and a vivid accent color" },
  { id: "warm", label: "Warm and editorial", text: "Make the design warm and editorial: serif type and earthy colors" },
  { id: "dark", label: "Dark", text: "Use a dark color scheme with one bright accent color" },
] as const;

const PUBLISH = [
  { id: "now", label: "Publish it right away", text: "publish it, then send me the link" },
  { id: "review", label: "Let me review first", text: "save it as a draft and show it to me before publishing" },
] as const;

// Each answer gets a color, reused for its chip in the finished prompt.
const COLORS = ["#16a34a", "#6d28d9", "#d97706", "#2563eb"];

type Answers = { kind?: (typeof KINDS)[number]; name: string; topic: string; style?: (typeof STYLES)[number]; publish?: (typeof PUBLISH)[number] };

function buildPrompt(a: Answers, appName: string) {
  const kind = a.kind ?? KINDS[0];
  const name = a.name.trim() || "My Site";
  const topic = a.topic.trim() || "what this site is about";
  const first = kind.id === "company" ? "a homepage headline, three feature blurbs, and a first blog post" : "a first post";
  return `Use ${appName} to create a ${kind.noun} called "${name}" with the ${kind.template} template. ${(a.style ?? STYLES[0]).text}. Write ${first} about ${topic}, add a fitting image with alt text, set the SEO title and description, and ${(a.publish ?? PUBLISH[0]).text}.`;
}

function Choice<T extends { id: string; label: string }>({ options, value, onPick, color }: { options: readonly T[]; value?: T; onPick: (o: T) => void; color: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o)}
          aria-pressed={value?.id === o.id}
          style={{ "--i": i, ...(value?.id === o.id ? { background: color, borderColor: color, color: "#fff" } : {}) } as React.CSSProperties}
          className={cn("lp-opt lp-shadow rounded-xl border border-transparent bg-background px-3.5 py-3 text-left text-sm", value?.id === o.id ? "is-picked" : "hover:border-foreground/20")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Four questions → one prompt the visitor pastes into their agent. */
export function PromptBuilder({ appName }: { appName: string }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [seen, setSeen] = useState(false);
  const [a, setA] = useState<Answers>({ name: "", topic: "" });
  const root = useRef<HTMLDivElement>(null);
  const total = 4;

  // Play the first question's entrance only once the quiz scrolls into view.
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  // Let the picked tile bounce before moving on.
  const pickThen = (update: Partial<Answers>) => {
    setA((prev) => ({ ...prev, ...update }));
    setTimeout(() => go(step + 1), 260);
  };
  const qClass = cn("lp-q", seen && "is-in", dir < 0 && "is-back");

  const chips = [a.kind?.label, a.name.trim() || undefined, a.style?.label, a.publish?.label];

  return (
    <div ref={root} className="overflow-hidden rounded-[28px] bg-foreground/[0.035] p-5 sm:p-7">
      {step < total ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
              <i className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${((step + 1) / total) * 100}%`, background: COLORS[step] }} />
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {step + 1} of {total}
            </p>
          </div>
          <div key={step} className={cn(qClass, "mt-6 min-h-[170px]")}>
            {step === 0 ? (
              <fieldset>
                <legend className="mb-4 text-xl font-semibold tracking-tight">What are you making?</legend>
                <Choice options={KINDS} value={a.kind} color={COLORS[0]} onPick={(kind) => pickThen({ kind })} />
              </fieldset>
            ) : step === 1 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  go(2);
                }}
                className="space-y-3"
              >
                <label className="block">
                  <span className="mb-2 block text-xl font-semibold tracking-tight">What&rsquo;s it called?</span>
                  <input autoFocus={seen} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} maxLength={80} placeholder="The Engineering Journal" className="lp-opt lp-shadow h-11 w-full rounded-xl bg-background px-3.5 text-sm outline-none focus:ring-3 focus:ring-ring/50" style={{ "--i": 0 } as React.CSSProperties} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-muted-foreground">What should the first post be about?</span>
                  <input value={a.topic} onChange={(e) => setA({ ...a, topic: e.target.value })} maxLength={200} placeholder="how AI is changing software engineering" className="lp-opt lp-shadow h-11 w-full rounded-xl bg-background px-3.5 text-sm outline-none focus:ring-3 focus:ring-ring/50" style={{ "--i": 1 } as React.CSSProperties} />
                </label>
                <Button type="submit" disabled={!a.name.trim()}>
                  Next →
                </Button>
              </form>
            ) : step === 2 ? (
              <fieldset>
                <legend className="mb-4 text-xl font-semibold tracking-tight">What should it feel like?</legend>
                <Choice options={STYLES} value={a.style} color={COLORS[2]} onPick={(style) => pickThen({ style })} />
              </fieldset>
            ) : (
              <fieldset>
                <legend className="mb-4 text-xl font-semibold tracking-tight">When it&rsquo;s written…</legend>
                <Choice options={PUBLISH} value={a.publish} color={COLORS[3]} onPick={(publish) => pickThen({ publish })} />
              </fieldset>
            )}
          </div>
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className="mt-3 text-sm text-muted-foreground hover:text-foreground">
              ← Back
            </button>
          ) : null}
        </>
      ) : (
        <div key="result" className={cn("lp-q is-in space-y-5")}>
          <p className="text-xl leading-relaxed font-semibold tracking-tight">
            {chips.map((t, i) =>
              t ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  className="lp-chip mr-1.5 text-base font-medium"
                  style={{ "--c": COLORS[i], "--i": i, "--tilt": `${[-3, 2.5, -2, 3][i]}deg` } as React.CSSProperties}
                  title="Change this answer"
                >
                  {t}
                </button>
              ) : null,
            )}
          </p>
          <div className="lp-rise space-y-4">
            <CopyPrompt prompt={buildPrompt(a, appName)} label="Your prompt · paste after connecting your agent" />
            <div className="flex flex-wrap gap-2">
              <a href="/signup" className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/80">
                Create a free site
              </a>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setA({ name: "", topic: "" });
                  go(0);
                }}
              >
                Start over
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
