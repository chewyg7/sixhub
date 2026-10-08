import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { safeEqual, sha256 } from "./crypto";

/** RFC 6238 time-based one-time passwords (SHA-1, 6 digits, 30 s), compatible with every authenticator app. */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

function codeAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/**
 * Checks a code against the current step ±1 (clock drift). Returns the
 * matched step so callers can reject reuse of the same or older codes.
 */
export function verifyTotp(secret: string, code: string, lastStep: number, now = Date.now()): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const step = Math.floor(now / 30000);
  for (const s of [step - 1, step, step + 1]) {
    if (s <= lastStep) continue;
    if (safeEqual(codeAt(secret, s), c)) return s;
  }
  return null;
}

export function otpauthUrl(secret: string, username: string) {
  const label = encodeURIComponent(`GTA 6 Hub:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("GTA 6 Hub")}&algorithm=SHA1&digits=6&period=30`;
}

/** Ten single-use recovery codes; only their hashes are stored. */
export function newRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: 10 }, () => {
    const raw = base32Encode(randomBytes(8)).slice(0, 10).toLowerCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

export const normalizeRecovery = (c: string) => c.trim().toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(.{5})(.{5})$/, "$1-$2");
