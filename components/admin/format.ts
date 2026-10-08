/** Shared by server and client admin components. */
export function formatTime(ms: number | null | undefined) {
  if (!ms) return "Never";
  return new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
