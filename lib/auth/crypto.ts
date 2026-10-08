import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/db";

/**
 * Server secret used to encrypt sensitive columns (TOTP secrets). Taken from
 * AUTH_SECRET (base64, 32 bytes) or, failing that, generated once into
 * `<DATA_DIR>/auth.key` with owner-only permissions. Never commit either.
 */
let key: Buffer | null = null;
function secretKey(): Buffer {
  if (key) return key;
  const env = process.env.AUTH_SECRET;
  if (env) {
    const k = Buffer.from(env, "base64");
    if (k.length !== 32) throw new Error("AUTH_SECRET must be 32 bytes, base64-encoded (openssl rand -base64 32)");
    return (key = k);
  }
  const file = path.join(DATA_DIR, "auth.key");
  if (!existsSync(file)) {
    writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  try {
    chmodSync(file, 0o600);
  } catch {}
  return (key = Buffer.from(readFileSync(file, "utf8").trim(), "base64"));
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function decrypt(blob: string): string {
  const raw = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", secretKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** URL-safe random token with `bytes` of entropy. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
