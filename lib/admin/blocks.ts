import type { InfoBlock, InfoFact } from "@/types/content";

/**
 * Plain-text editing for info entries:
 *   blank line   → new block
 *   "- item"     → bullet list (every line in the block)
 *   "> text"     → highlighted note
 *   anything else → paragraph
 */
export function blocksToText(blocks: InfoBlock[]): string {
  return blocks
    .map((b) => (b.type === "list" ? b.items.map((i) => `- ${i}`).join("\n") : b.type === "note" ? `> ${b.text}` : b.text))
    .join("\n\n");
}

export function textToBlocks(text: string): InfoBlock[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): InfoBlock => {
      const ls = chunk.split("\n").map((l) => l.trim());
      if (ls.every((l) => l.startsWith("- "))) return { type: "list", items: ls.map((l) => l.slice(2).trim()) };
      if (chunk.startsWith("> ")) return { type: "note", text: ls.map((l) => l.replace(/^>\s?/, "")).join(" ") };
      return { type: "paragraph", text: ls.join(" ") };
    });
}

export const factsToText = (facts: InfoFact[]) => facts.map((f) => `${f.label}: ${f.value}`).join("\n");
export const textToFacts = (text: string): InfoFact[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { label: l, value: "" };
    });
