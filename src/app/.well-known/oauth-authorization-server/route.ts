import { json, preflight } from "@/server/http/util";
import { authorizationServerMetadata } from "@/server/oauth/oauth";

export function GET() {
  return json(authorizationServerMetadata(), { cors: true });
}
export const OPTIONS = preflight;
