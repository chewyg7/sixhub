import Link from "next/link";
import type { TagRef, TagType } from "@/types/content";
import { TAG_TYPE_LABEL, tagHref } from "@/lib/content/relations";

const ORDER: TagType[] = ["character", "location", "source", "collection", "category", "kind", "tag"];

/** Tags grouped by relationship type; every chip links to everything related. */
export function TagList({ tags }: { tags: TagRef[] }) {
  const groups = ORDER.map((t) => ({ type: t, items: tags.filter((x) => x.type === t) })).filter((g) => g.items.length);
  return (
    <dl className="space-y-3">
      {groups.map((g) => (
        <div key={g.type} className="grid grid-cols-[96px_1fr] items-start gap-3">
          <dt className="pt-1 text-[12px] text-faint">{g.type === "tag" ? "Tags" : TAG_TYPE_LABEL[g.type]}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {g.items.map((t) => (
              <Link
                key={`${t.type}:${t.value}`}
                href={tagHref(t)}
                className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-[12.5px] text-text transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                {t.label}
              </Link>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
