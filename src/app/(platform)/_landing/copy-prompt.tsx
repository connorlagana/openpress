"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A prompt the visitor pastes into their agent. Doubles as the primary call to action. `children` overrides how the text renders. */
export function CopyPrompt({ prompt, label = "Paste into your agent", children }: { prompt: string; label?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p data-prompt className="px-3 py-3 font-mono text-[13px] leading-relaxed">
        {children ?? prompt}
      </p>
    </div>
  );
}
