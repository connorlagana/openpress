"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, updateProfileAction } from "../actions";

export function ProfileForm({ name: initial }: { name: string }) {
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex max-w-xl items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateProfileAction(name);
          if (res.ok) toast.success("Saved");
          else toast.error(res.error);
        });
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid max-w-xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        start(async () => {
          const res = await changePasswordAction(String(f.get("current")), String(f.get("next")));
          if (!res.ok) return void toast.error(res.error);
          toast.success("Password changed");
          form.reset();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="current">Current</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="next">New</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Change
      </Button>
    </form>
  );
}
