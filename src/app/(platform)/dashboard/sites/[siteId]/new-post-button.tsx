"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { newPostAction } from "../../actions";

export function NewPostButton({ siteId, kind }: { siteId: string; kind: "post" | "page" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await newPostAction(siteId, kind);
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? "Creating…" : kind === "page" ? "New page" : "New post"}
    </Button>
  );
}
