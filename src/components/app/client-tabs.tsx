"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/app/copy-button";
import { buttonVariants } from "@/components/ui/button";
import type { ClientInstructions } from "@/lib/clients";
import { cn } from "@/lib/utils";

/** Tabbed per-client MCP setup: numbered steps, a copyable snippet, and a one-click install link where supported. */
export function ClientTabs({ clients }: { clients: ClientInstructions[] }) {
  const [active, setActive] = useState(clients[0].id);
  const c = clients.find((x) => x.id === active)!;
  return (
    <div>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="AI client">
        {clients.map((x) => (
          <button
            key={x.id}
            id={`client-tab-${x.id}`}
            role="tab"
            aria-selected={x.id === active}
            aria-controls="client-panel"
            onClick={() => setActive(x.id)}
            className={cn("rounded-full px-3 py-1 text-sm", x.id === active ? "bg-foreground/[.07] font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {x.name}
          </button>
        ))}
      </div>
      <div id="client-panel" role="tabpanel" aria-labelledby={`client-tab-${c.id}`} className="mt-4 space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {c.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <CodeBlock code={c.code} />
        {c.installUrl ? (
          <a href={c.installUrl} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {c.installLabel} ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
