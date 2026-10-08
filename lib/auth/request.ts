import "server-only";
import { headers } from "next/headers";

/**
 * The client's IP address. Behind a reverse proxy (Caddy/nginx) the proxy
 * appends the real address to X-Forwarded-For, so we read the entry the
 * trusted proxy added — counting TRUSTED_PROXY_HOPS from the right — rather
 * than the leftmost one, which the client can forge.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1));
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ip = parts[Math.max(0, parts.length - hops)];
    if (ip) return ip.slice(0, 64);
  }
  return (h.get("x-real-ip") ?? "unknown").slice(0, 64);
}

export async function userAgent(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 300);
}

/** Short, readable device label from a user agent ("Chrome on Windows"). */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}
