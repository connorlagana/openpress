import { json, preflight } from "@/server/http/util";
import { protectedResourceMetadata } from "@/server/oauth/oauth";

// Served at both /.well-known/oauth-protected-resource and .../mcp (RFC 9728 path form).
export function GET() {
  return json(protectedResourceMetadata(), { cors: true });
}
export const OPTIONS = preflight;
