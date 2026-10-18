import { AwsClient } from "aws4fetch";
import { config } from "@/lib/config";

/**
 * Object storage. STORAGE_DRIVER=r2 uses Cloudflare R2 through its S3 API
 * (works on Node and Workers); "local" writes to ./.data/media for development.
 */
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements Storage {
  private async paths(key: string) {
    const path = await import("node:path");
    if (key.includes("..")) throw new Error("bad key");
    const root = path.resolve(process.env.LOCAL_MEDIA_DIR ?? ".data/media");
    return { file: path.join(root, key), meta: path.join(root, key + ".type") };
  }
  async put(key: string, body: Uint8Array, contentType: string) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const p = await this.paths(key);
    await fs.mkdir(path.dirname(p.file), { recursive: true });
    await fs.writeFile(p.file, body);
    await fs.writeFile(p.meta, contentType);
  }
  async get(key: string) {
    const fs = await import("node:fs/promises");
    const p = await this.paths(key);
    try {
      return { body: new Uint8Array(await fs.readFile(p.file)), contentType: await fs.readFile(p.meta, "utf8") };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    const fs = await import("node:fs/promises");
    const p = await this.paths(key);
    await fs.rm(p.file, { force: true });
    await fs.rm(p.meta, { force: true });
  }
}

class R2Storage implements Storage {
  private client = new AwsClient({
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  private base = `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${required("R2_BUCKET")}`;

  async put(key: string, body: Uint8Array, contentType: string) {
    const res = await this.client.fetch(`${this.base}/${encodeURI(key)}`, {
      method: "PUT",
      body: body as BodyInit,
      headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) throw new Error(`R2 put failed: ${res.status}`);
  }
  async get(key: string) {
    const res = await this.client.fetch(`${this.base}/${encodeURI(key)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 get failed: ${res.status}`);
    return { body: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }
  async delete(key: string) {
    const res = await this.client.fetch(`${this.base}/${encodeURI(key)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: ${res.status}`);
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required when STORAGE_DRIVER=r2`);
  return v;
}

let instance: Storage | undefined;
export function getStorage(): Storage {
  instance ??= process.env.STORAGE_DRIVER === "r2" ? new R2Storage() : new LocalStorage();
  return instance;
}

/** Public URL for a stored object: the R2 public bucket domain if configured, otherwise our /m/ proxy route. */
export function mediaUrl(key: string): string {
  const base = process.env.MEDIA_PUBLIC_URL;
  return base ? `${base.replace(/\/$/, "")}/${key}` : `${config.appUrl}/m/${key}`;
}
