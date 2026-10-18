"use client";

import { useEffect } from "react";

/** First-touch attribution: remember where this visitor came from until they sign up (read in signUpAction). */
export function RememberRef({ source }: { source: string }) {
  useEffect(() => {
    try {
      if (!document.cookie.split("; ").some((c) => c.startsWith("op_ref="))) document.cookie = `op_ref=${source}; path=/; max-age=${30 * 86400}; samesite=lax`;
    } catch {}
  }, [source]);
  return null;
}
