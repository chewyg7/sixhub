"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { FaqEntry } from "@/types/content";
import { cn } from "@/lib/cn";

/** Answers are plain text; blank lines start a new paragraph. */
function Answer({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="mt-3 first:mt-0">
          {p}
        </p>
      ))}
    </>
  );
}

/** Accordion of questions. Open answers grow smoothly (grid-rows transition). */
export function FaqList({ items, defaultOpen }: { items: FaqEntry[]; defaultOpen?: string }) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);
  return (
    <ul className="divide-y divide-white/10 border-y border-white/10">
      {items.map((f) => {
        const isOpen = open === f.id;
        return (
          <li key={f.id} id={f.id} className="scroll-mt-28">
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${f.id}`}
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="group flex w-full items-center justify-between gap-6 py-6 text-left"
              >
                <span className={cn("display text-[20px] leading-snug transition-colors duration-300 sm:text-[24px]", isOpen ? "text-accent-text" : "text-text group-hover:text-accent-text")}>
                  {f.question}
                </span>
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-500 ease-[var(--ease-out)]",
                    isOpen ? "rotate-45 border-accent bg-accent text-white" : "border-white/15 text-white group-hover:border-white/40",
                  )}
                >
                  <Plus className="size-5" />
                </span>
              </button>
            </h3>
            <div id={`faq-${f.id}`} role="region" className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-out)]", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
              <div className="overflow-hidden">
                <div className="max-w-3xl pb-7 text-[16px] leading-relaxed text-muted">
                  <Answer text={f.answer} />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
