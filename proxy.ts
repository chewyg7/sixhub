import { NextResponse, type NextRequest } from "next/server";
import { PREFS_BOOT_SCRIPT } from "@/lib/preferences-script";

/**
 * Strict Content Security Policy for the admin panel (/chewy). Every request
 * gets a fresh nonce, which Next.js adds to its own scripts; the one inline
 * script we ship (theme boot) is allowed by its exact SHA-256. Any other
 * injected script, frame or form target is refused by the browser.
 * Uploads (/chewy/api/*) are excluded so large request bodies stream straight
 * to their route handler.
 */
let bootHash: string | null = null;
async function bootScriptHash() {
  if (bootHash) return bootHash;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PREFS_BOOT_SCRIPT));
  bootHash = `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
  return bootHash;
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${await bootScriptHash()}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // gtavice.net thumbnails appear in the grabber's preview.
    "img-src 'self' blob: data: https://www.gtavice.net",
    "media-src 'self' blob: https:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  return response;
}

export const config = {
  matcher: [
    {
      // Every admin page except /chewy/api/* (uploads stream there directly).
      source: "/chewy/((?!api/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    "/chewy",
  ],
};
