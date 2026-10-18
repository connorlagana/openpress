"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteMediaAction } from "../../../actions";

export function UploadForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
        className="sr-only"
        aria-label="Choose image"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          const body = new FormData();
          body.set("file", file);
          body.set("siteId", siteId);
          body.set("altText", file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "));
          const res = await fetch("/api/media", { method: "POST", body });
          setBusy(false);
          e.target.value = "";
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return void toast.error(data.error_description ?? "Upload failed");
          }
          toast.success("Uploaded");
          router.refresh();
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Uploading…" : "Upload image"}
      </Button>
    </>
  );
}

export function DeleteMediaButton({ siteId, mediaId }: { siteId: string; mediaId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Delete image"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this image? Posts that embed it will show a broken image.")) return;
        start(async () => {
          const res = await deleteMediaAction(siteId, mediaId);
          if (!res.ok) toast.error(res.error);
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}
