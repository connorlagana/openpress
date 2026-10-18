import { json, preflight } from "@/server/http/util";
import { revokeToken } from "@/server/oauth/oauth";

// RFC 7009: always 200, even for unknown tokens.
export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());
  const token = form.get("token");
  if (token) await revokeToken(token);
  return json({}, { cors: true });
}
export const OPTIONS = preflight;
