"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CodeBlock } from "@/components/app/copy-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Scope } from "@/server/actor";
import { createApiKeyAction, revokeConnectionAction, updateConnectionAction } from "../actions";

type Grant = { scopes: Scope[]; allSites: boolean; siteIds: string[]; confirmPublish: boolean };

function GrantFields({ value, onChange, sites, scopes }: { value: Grant; onChange: (g: Grant) => void; sites: { id: string; name: string }[]; scopes: Record<Scope, string> }) {
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Permissions</legend>
        {(Object.keys(scopes) as Scope[]).map((s) => (
          <label key={s} className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={value.scopes.includes(s)}
              onCheckedChange={(on) => onChange({ ...value, scopes: on ? [...value.scopes, s] : value.scopes.filter((x) => x !== s) })}
              className="mt-0.5"
            />
            <span>
              <span className="font-mono text-xs">{s}</span>
              <span className="block text-muted-foreground">{scopes[s]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Sites</legend>
        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox checked={value.allSites} onCheckedChange={(on) => onChange({ ...value, allSites: !!on })} />
          All sites, including future ones
        </label>
        {!value.allSites
          ? sites.map((s) => (
              <label key={s.id} className="flex items-center gap-2.5 pl-6 text-sm">
                <Checkbox
                  checked={value.siteIds.includes(s.id)}
                  onCheckedChange={(on) => onChange({ ...value, siteIds: on ? [...value.siteIds, s.id] : value.siteIds.filter((x) => x !== s.id) })}
                />
                {s.name}
              </label>
            ))
          : null}
      </fieldset>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Ask me before publishing
          <span className="block text-muted-foreground">The agent must get your explicit OK in chat for each publish. Deletes always ask.</span>
        </span>
        <Switch checked={value.confirmPublish} onCheckedChange={(v) => onChange({ ...value, confirmPublish: v })} />
      </label>
    </div>
  );
}

export function ConnectionActions({ connection, sites, scopes }: { connection: Grant & { id: string; name: string }; sites: { id: string; name: string }[]; scopes: Record<Scope, string> }) {
  const [open, setOpen] = useState(false);
  const [grant, setGrant] = useState<Grant>(connection);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Permissions</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{connection.name}</DialogTitle>
            <DialogDescription>Changes apply to the agent&rsquo;s next request.</DialogDescription>
          </DialogHeader>
          <GrantFields value={grant} onChange={setGrant} sites={sites} scopes={scopes} />
          <DialogFooter>
            <Button
              disabled={pending || !grant.scopes.length}
              onClick={() =>
                start(async () => {
                  const res = await updateConnectionAction(connection.id, grant);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Permissions updated");
                  setOpen(false);
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Revoke access for ${connection.name}? It will stop working immediately.`)) return;
          start(async () => {
            const res = await revokeConnectionAction(connection.id);
            if (!res.ok) toast.error(res.error);
            else toast.success("Access revoked");
          });
        }}
      >
        Revoke
      </Button>
    </div>
  );
}

export function NewApiKey({ sites, scopes, mcpUrl }: { sites: { id: string; name: string }[]; scopes: Record<Scope, string>; mcpUrl: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My agent");
  const [grant, setGrant] = useState<Grant>({ scopes: ["sites:read", "sites:write", "content:write", "content:publish", "analytics:read"], allSites: true, siteIds: [], confirmPublish: false });
  const [key, setKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setKey(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>Create API key</DialogTrigger>
      <DialogContent>
        {key ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your API key</DialogTitle>
              <DialogDescription>It won&rsquo;t be shown again.</DialogDescription>
            </DialogHeader>
            <CodeBlock code={key} />
            <CodeBlock code={JSON.stringify({ url: mcpUrl, headers: { Authorization: `Bearer ${key}` } }, null, 2)} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New API key</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <GrantFields value={grant} onChange={setGrant} sites={sites} scopes={scopes} />
            <DialogFooter>
              <Button
                disabled={pending || !name.trim() || !grant.scopes.length}
                onClick={() =>
                  start(async () => {
                    const res = await createApiKeyAction({ name, ...grant });
                    if (!res.ok) return void toast.error(res.error);
                    setKey(res.data!.key);
                  })
                }
              >
                Create key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
