"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function CodeBlock({ code, copy = true }: { code: string; copy?: boolean }) {
  return (
    <div className="relative rounded-xl bg-muted/70">
      <pre className="overflow-x-auto p-3 pr-24 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
      {copy ? (
        <div className="absolute top-2 right-2">
          <CopyButton value={code} />
        </div>
      ) : null}
    </div>
  );
}
