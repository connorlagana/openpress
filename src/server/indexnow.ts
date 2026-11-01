import { after } from "next/server";
import { config } from "@/lib/config";
import { hmacHex } from "@/lib/crypto";

// IndexNow (https://www.indexnow.org) tells Bing, Yandex, Seznam, Naver and
// friends that a URL changed, so new posts get crawled in minutes instead of
// whenever the crawler next wanders by. Google doesn't take part; for Google,
// owners verify the site in Search Console and submit /sitemap.xml.
//
// Each site gets its own key, derived from APP_SECRET, so nothing is stored.
// The key is served at KEY_PATH on the site's own host, which is how IndexNow
// checks that we're allowed to submit URLs for it.

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const KEY_PATH = "/indexnow-key.txt";

export async function indexNowKey(subdomain: string): Promise<string> {
  return (await hmacHex(config.secret, `indexnow|${subdomain}`)).slice(0, 32);
}

/** On for https hosts unless INDEXNOW=off. INDEXNOW=on forces it (tests, staging). */
export function indexNowEnabled(): boolean {
  const flag = process.env.INDEXNOW?.toLowerCase();
  if (flag === "off" || flag === "false" || flag === "0") return false;
  if (flag === "on" || flag === "true" || flag === "1") return true;
  return config.protocol === "https";
}

/** Submit changed paths for one site. Never throws: a failed ping must not fail a publish. */
export async function pingIndexNow(subdomain: string, paths: string[], fetchImpl: typeof fetch = fetch): Promise<number | null> {
  const unique = [...new Set(paths)];
  if (!unique.length) return null;
  const base = config.siteUrl(subdomain);
  const body = {
    host: new URL(base).hostname,
    key: await indexNowKey(subdomain),
    keyLocation: base + KEY_PATH,
    urlList: unique.map((p) => base + p),
  };
  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    // 200 = accepted, 202 = accepted pending key check. Anything else is worth a log line.
    if (res.status !== 200 && res.status !== 202) console.warn(`[indexnow] ${subdomain}: HTTP ${res.status}`);
    return res.status;
  } catch (e) {
    console.warn(`[indexnow] ${subdomain}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

const pending = new Set<Promise<unknown>>();

/**
 * Queue a ping to run after the response is sent. Call it only after the
 * change has committed. Outside a request (scripts, tests) it runs in the
 * background instead; flushIndexNow() waits for those.
 */
export function notifyIndexNow(subdomain: string, paths: string[]): void {
  if (!indexNowEnabled() || !paths.length) return;
  const task = () => pingIndexNow(subdomain, paths);
  try {
    after(task);
  } catch {
    const p = task().finally(() => pending.delete(p));
    pending.add(p);
  }
}

export async function flushIndexNow(): Promise<void> {
  await Promise.all([...pending]);
}
