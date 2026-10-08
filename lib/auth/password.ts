import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt at OWASP-recommended cost (N=2^17, r=8, p=1).
 * Stored as `scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>` so parameters can be
 * raised later; `needsRehash` tells login to upgrade old hashes.
 * scripts/admin-user.mjs writes the same format; keep them in step.
 */
const N = 131072;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 256 * 1024 * 1024;

const scrypt = (pw: string, salt: Buffer, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw.normalize("NFKC"), salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(32);
  const key = await scrypt(pw, salt, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(pw, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function needsRehash(stored: string) {
  const [, n, r, p] = stored.split("$");
  return Number(n) < N || Number(r) !== R || Number(p) !== P;
}

/** A real hash of a random password, used to spend the same time on unknown usernames. */
let dummy: Promise<string> | null = null;
export const dummyHash = () => (dummy ??= hashPassword(randomBytes(16).toString("hex")));

const COMMON = ["password", "123456", "qwerty", "letmein", "welcome", "admin", "iloveyou", "monkey", "dragon", "football", "gta6", "gtavi", "rockstar", "leonida", "vicecity"];

/** Returns a reason the password is too weak, or null if it's acceptable. */
export function passwordProblem(pw: string, username: string): string | null {
  if (pw.length < 12) return "Use at least 12 characters.";
  if (pw.length > 200) return "Use at most 200 characters.";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) return "Mix at least three of: lowercase, uppercase, numbers and symbols.";
  const lower = pw.toLowerCase();
  if (username && lower.includes(username.toLowerCase())) return "Don't include your username.";
  if (COMMON.some((w) => lower.replace(/[^a-z0-9]/g, "").includes(w) && lower.length < w.length + 6)) return "That's too close to a common password.";
  if (/(.)\1{4,}/.test(pw)) return "Avoid long runs of the same character.";
  return null;
}
