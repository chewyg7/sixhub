"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { RESOLUTION_TIERS } from "@/lib/format";
import { FACET_KEYS, type ArchiveQuery, type FacetKey } from "./query";

export interface FacetOption {
  value: string;
  label: string;
}

export const FACET_TITLE: Record<FacetKey, string> = {
  category: "Category",
  type: "Media type",
  character: "Character",
  location: "Location",
  source: "Trailer / source",
  resolution: "Resolution",
  orientation: "Orientation",
  tag: "Tags",
};

interface Props {
  query: ArchiveQuery;
  options: Record<FacetKey, FacetOption[]>;
  counts: Record<FacetKey, Map<string, number>>;
  onToggle: (key: FacetKey, value: string) => void;
  onDate: (key: "from" | "to", value: string) => void;
  hideCategory?: boolean;
}

function FacetGroup({ title, children, defaultOpen = true, activeCount }: { title: string; children: React.ReactNode; defaultOpen?: boolean; activeCount: number }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-b border-divider py-3 last:border-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-left text-[13px] font-semibold text-text"
      >
        <span className="flex items-center gap-2">
          {title}
          {activeCount > 0 && <span className="tabular rounded-[4px] bg-accent-soft px-1.5 text-[11px] text-accent-text">{activeCount}</span>}
        </span>
        <ChevronDown className={cn("size-4 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div id={id} hidden={!open} className="mt-1.5">
        {children}
      </div>
    </div>
  );
}

export function FilterPanel({ query, options, counts, onToggle, onDate, hideCategory }: Props) {
  const [showAllTags, setShowAllTags] = useState(false);
  return (
    <div>
      {FACET_KEYS.map((key) => {
        if (key === "category" && hideCategory) return null;
        let opts = options[key];
        if (key === "resolution") opts = RESOLUTION_TIERS.filter((t) => counts.resolution.has(t) || query.resolution.includes(t)).map((t) => ({ value: t, label: t }));
        const selected = query[key] as string[];
        // Hide options with no results unless selected, so filters never lead to dead ends.
        opts = opts.filter((o) => (counts[key].get(o.value) ?? 0) > 0 || selected.includes(o.value));
        if (!opts.length) return null;
        if (key === "tag") opts = [...opts].sort((a, b) => (counts.tag.get(b.value) ?? 0) - (counts.tag.get(a.value) ?? 0));
        const limited = key === "tag" && !showAllTags ? opts.slice(0, 10) : opts;
        return (
          <FacetGroup key={key} title={FACET_TITLE[key]} activeCount={selected.length} defaultOpen={key !== "tag" || selected.length > 0}>
            {key === "tag" ? (
              <div className="flex flex-wrap gap-1.5">
                {limited.map((o) => {
                  const on = selected.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onToggle(key, o.value)}
                      className={cn(
                        "h-7 rounded-md border px-2 text-[12px] transition-colors",
                        on ? "border-transparent bg-text text-bg" : "border-border text-muted hover:border-border-strong hover:text-text",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
                {opts.length > 10 && (
                  <button type="button" onClick={() => setShowAllTags((s) => !s)} className="h-7 px-1 text-[12px] font-medium text-muted hover:text-text">
                    {showAllTags ? "Show fewer" : `+${opts.length - 10} more`}
                  </button>
                )}
              </div>
            ) : (
              <ul className="space-y-px">
                {limited.map((o) => {
                  const on = selected.includes(o.value);
                  const n = counts[key].get(o.value) ?? 0;
                  return (
                    <li key={o.value}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-[5px] text-[13px] transition-colors hover:bg-surface-hover",
                          on ? "text-text" : "text-muted",
                        )}
                      >
                        <input type="checkbox" checked={on} onChange={() => onToggle(key, o.value)} className="size-3.5 cursor-pointer rounded-[3px] accent-[var(--text)]" />
                        <span className="flex-1 truncate">{o.label}</span>
                        <span className="tabular text-[11.5px] text-faint">{n}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </FacetGroup>
        );
      })}
      <FacetGroup title="Date published" activeCount={(query.from ? 1 : 0) + (query.to ? 1 : 0)} defaultOpen={Boolean(query.from || query.to)}>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[12px] text-muted">
            From
            <input
              type="date"
              value={query.from}
              max={query.to || undefined}
              onChange={(e) => onDate("from", e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-border bg-surface px-2 text-[12.5px] text-text"
            />
          </label>
          <label className="text-[12px] text-muted">
            To
            <input
              type="date"
              value={query.to}
              min={query.from || undefined}
              onChange={(e) => onDate("to", e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-border bg-surface px-2 text-[12.5px] text-text"
            />
          </label>
        </div>
      </FacetGroup>
    </div>
  );
}
