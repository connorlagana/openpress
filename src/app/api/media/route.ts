import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import { userForSessionToken } from "@/server/auth/accounts";
import { SESSION_COOKIE } from "@/server/auth/session";
import { clientIpFrom, errorResponse, json, sameOrigin } from "@/server/http/util";
import { uploadMedia } from "@/server/services/media";
import { rateLimit } from "@/server/services/ratelimit";

// Dashboard uploads (multipart). Agents use the upload_media MCP tool instead.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = token ? await userForSessionToken(token) : null;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  try {
    await rateLimit(`upload:user:${user.id}`, 30);
    const form = await req.formData();
    const file = form.get("file");
    const siteId = String(form.get("siteId") ?? "");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "No file provided");
    if (file.size > 10 * 1024 * 1024) throw new AppError("QUOTA_EXCEEDED", "File is too large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const media = await uploadMedia(
      { kind: "user", userId: user.id, ip: clientIpFrom(req) },
      { siteId, filename: file.name, altText: String(form.get("altText") ?? "") || undefined },
      bytes,
    );
    return json({ media }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
