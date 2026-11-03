"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewCustomVizAction } from "../../../../actions";

export function ReviewForm({ siteId, vizId, codeHash, status }: { siteId: string; vizId: string; codeHash: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const decide = (decision: "approve" | "reject") =>
    start(async () => {
      const res = await reviewCustomVizAction(siteId, vizId, decision, codeHash, note);
      if (!res.ok) return void toast.error(res.error);
      toast.success(decision === "approve" ? "Approved: it now runs wherever it is embedded" : "Rejected");
      router.refresh();
    });
  return (
    <section className="op-card space-y-3 p-4">
      <label className="block text-sm font-medium" htmlFor="review-note">
        Review note <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => decide("approve")} disabled={pending || status === "approved"}>
          {status === "approved" ? "Approved" : "Approve this code"}
        </Button>
        <Button variant="outline" onClick={() => decide("reject")} disabled={pending || status === "rejected"}>
          Reject
        </Button>
      </div>
    </section>
  );
}
