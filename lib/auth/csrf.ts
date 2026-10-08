import "server-only";
import type { NextRequest } from "next/server";
import { Forbidden } from "./session";

/**
 * CSRF protection for admin route handlers (server actions already compare
 * Origin and Host). A request must come from our own origin and carry the
 * `x-chewy` header, which other sites can't add to a cross-origin request
 * without a CORS preflight we never allow. The session cookie is also
 * SameSite=Strict.
 */
export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const site = request.headers.get("sec-fetch-site");
  if (request.headers.get("x-chewy") !== "1") throw new Forbidden("Missing request header.");
  if (!origin || !host) throw new Forbidden("Missing origin.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Forbidden("Bad origin.");
  }
  if (originHost !== host) throw new Forbidden("Cross-site request refused.");
  if (site && site !== "same-origin") throw new Forbidden("Cross-site request refused.");
}

export function errorResponse(e: unknown) {
  const message = e instanceof Error ? e.message : "Something went wrong.";
  const status = e instanceof Forbidden ? 403 : 400;
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
