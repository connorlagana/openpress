// WebCrypto only, so the same code runs on Node (dev/tests) and Cloudflare Workers.
const enc = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** URL-safe random token with `bytes` bytes of entropy, optionally prefixed (e.g. "fol_"). */
export function randomToken(bytes = 32, prefix = ""): string {
  return prefix + toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

export async function sha256Base64Url(input: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(input))));
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DEFAULT_ITERATIONS = 310_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return toHex(bits);
}

/** Format: pbkdf2-sha256$<iterations>$<saltHex>$<hashHex> */
export async function hashPassword(password: string): Promise<string> {
  const iterations = Number(process.env.PASSWORD_ITERATIONS ?? DEFAULT_ITERATIONS);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iterations}$${toHex(salt)}$${await pbkdf2(password, salt, iterations)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iter, saltHex, hash] = stored.split("$");
  if (algo !== "pbkdf2-sha256" || !iter || !saltHex || !hash) return false;
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  return safeEqual(await pbkdf2(password, salt, Number(iter)), hash);
}
