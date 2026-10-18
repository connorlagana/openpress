import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppError } from "@/lib/errors";
import { getSite } from "../services/sites";
import { requireActor } from "./session";

/** Dashboard helper: the signed-in user's site, or a 404. Memoized per request. */
export const loadDashboardSite = cache(async (siteId: string) => {
  const actor = await requireActor();
  try {
    return { actor, site: await getSite(actor, siteId) };
  } catch (e) {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
});
