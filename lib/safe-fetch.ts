import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetching addresses that visitors control (shared repo links), safely: only
 * https on the public internet (never this server, the local network or
 * cloud metadata addresses), every redirect checked again, a size cap and a
 * timeout.
 */

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (v6.startsWith("::ffff:")) return privateAddress(v6.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(v6);
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:") throw new Error("Only https links.");
  if (url.port && url.port !== "443") throw new Error("Unusual port.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateAddress(a.address))) throw new Error("Not a public address.");
}

export async function safeFetch(raw: string, { maxBytes, timeoutMs = 6000, revalidate = 3600 }: { maxBytes: number; timeoutMs?: number; revalidate?: number }) {
  let url = new URL(raw);
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: "manual", signal, headers: { "User-Agent": "GTA6Hub-preview/1.0 (+https://gtasixhub.com)" }, next: { revalidate } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error("Too large.");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error("Too large.");
    return { body: buf, url: url.href, type: res.headers.get("content-type") ?? "" };
  }
  throw new Error("Too many redirects.");
}
