import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

/** What every admin form action returns. */
export interface ActionState {
  ok?: string;
  error?: string;
  /** Bumps on every success so forms can reset or react. */
  n?: number;
}

/**
 * Runs an admin action: turns thrown errors into a form message (never
 * leaking stack traces), lets Next.js redirects through, and refreshes the
 * public site when content changed.
 */
export async function run(fn: () => Promise<string | void>, opts: { revalidate?: boolean } = { revalidate: true }): Promise<ActionState> {
  try {
    const ok = (await fn()) || "Saved.";
    if (opts.revalidate !== false) revalidatePath("/", "layout");
    return { ok, n: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return { error: first ? `${first.path.join(".") || "Input"}: ${first.message}` : "Some fields are invalid." };
    }
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/* Form helpers ------------------------------------------------------ */

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";
export const lines = (f: FormData, k: string) =>
  str(f, k)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
export const csv = (f: FormData, k: string) =>
  str(f, k)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
export const many = (f: FormData, k: string) => f.getAll(k).map((v) => String(v).trim()).filter(Boolean);

/** "Label | https://…" lines → source links (bad URLs are rejected). */
export function sourceLines(f: FormData, k: string) {
  return lines(f, k).map((l) => {
    const [label, url] = l.includes("|") ? l.split("|").map((s) => s.trim()) : [l, l];
    const u = new URL(url);
    if (!["https:", "http:"].includes(u.protocol)) throw new Error(`Links must be http(s): ${url}`);
    return { label: label || u.hostname, url: u.toString() };
  });
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const slugField = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes");
export const httpsUrl = z
  .string()
  .max(500)
  .refine((v) => {
    try {
      return ["https:", "http:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "Enter a full http(s) link");
