"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FolderPlus, Heart, History, Layers, MoreHorizontal, X } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import { Button, buttonClass } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Menu } from "@/components/ui/menu";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaCard } from "@/components/media/media-card";
import { MediaThumb } from "@/components/media/media-thumb";
import { NewCollectionDialog } from "@/components/media/add-to-collection";
import { IconButton } from "@/components/ui/icon-button";
import { library, useLibrary, useLibraryReady, type UserCollection } from "./store";

type Tab = "favorites" | "collections" | "recent";

export function LibraryView({ media }: { media: MediaItem[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const ready = useLibraryReady();
  const toast = useToast();
  const bySlug = useMemo(() => new Map(media.map((m) => [m.slug, m])), [media]);
  const favorites = useLibrary((s) => s.favorites);
  const collections = useLibrary((s) => s.collections);
  const recent = useLibrary((s) => s.recent);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<UserCollection | null>(null);

  const tab = (["favorites", "collections", "recent"].includes(params.get("tab") ?? "") ? params.get("tab") : "favorites") as Tab;
  const openId = params.get("c");
  const openCollection = collections.find((c) => c.id === openId);
  const setParams = (p: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(p)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`/library${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const resolve = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((m): m is MediaItem => Boolean(m));

  const remove = (c: UserCollection) => {
    library.deleteCollection(c.id);
    if (openId === c.id) setParams({ c: null });
    toast(`Deleted “${c.name}”`, { tone: "info", action: { label: "Undo", onClick: () => library.restoreCollection(c) }, duration: 6000 });
  };

  if (!ready) {
    return (
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[16/10] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Library section"
          value={tab}
          onChange={(t) => setParams({ tab: t === "favorites" ? null : t, c: null })}
          options={[
            {
              value: "favorites",
              label: (
                <>
                  <Heart /> Favorites <span className="tabular text-faint">{favorites.length}</span>
                </>
              ),
            },
            {
              value: "collections",
              label: (
                <>
                  <Layers /> Collections <span className="tabular text-faint">{collections.length}</span>
                </>
              ),
            },
            {
              value: "recent",
              label: (
                <>
                  <History /> Recent <span className="tabular text-faint">{recent.length}</span>
                </>
              ),
            },
          ]}
        />
        {tab === "collections" && !openCollection && (
          <Button onClick={() => setCreating(true)}>
            <FolderPlus /> New collection
          </Button>
        )}
        {tab === "recent" && recent.length > 0 && (
          <Button variant="ghost" onClick={() => library.clearRecent()}>
            Clear history
          </Button>
        )}
      </div>

      {tab === "favorites" &&
        (favorites.length ? (
          <MediaGrid items={resolve(favorites.map((f) => f.slug))} />
        ) : (
          <EmptyState
            icon={<Heart />}
            title="No favorites yet"
            description="Use the heart on any media item to keep it here."
            action={
              <Link href="/media" className={buttonClass({ size: "sm" })}>
                Browse media
              </Link>
            }
          />
        ))}

      {tab === "recent" &&
        (recent.length ? (
          <MediaGrid items={resolve(recent.map((r) => r.slug))} layout="compact" />
        ) : (
          <EmptyState icon={<History />} title="Nothing viewed yet" description="Media you open in the lightbox, detail pages or Media Viewer appears here." />
        ))}

      {tab === "collections" && openCollection && (
        <div>
          <button type="button" onClick={() => setParams({ c: null })} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
            <ArrowLeft className="size-4" /> All collections
          </button>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="display text-[36px]">{openCollection.name}</h2>
              <p className="mt-1 text-[13px] text-muted">
                {pluralize(openCollection.items.length, "item")} · updated {formatDate(openCollection.updatedAt, "short")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRenaming(openCollection)}>
                Rename
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(openCollection)}>
                Delete
              </Button>
            </div>
          </div>
          {openCollection.items.length ? (
            <div className="grid grid-cols-1 gap-x-4 gap-y-7 xs:grid-cols-2 lg:grid-cols-4">
              {resolve(openCollection.items).map((m, i, all) => (
                <div key={m.slug} className="relative">
                  <MediaCard item={m} group={all} index={i} />
                  <IconButton
                    label={`Remove ${m.title} from collection`}
                    variant="glass"
                    size="icon-sm"
                    className="absolute top-2 right-2 text-white"
                    onClick={() => library.toggleInCollection(openCollection.id, m.slug)}
                  >
                    <X />
                  </IconButton>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact title="This collection is empty" description="Use “Save to collection” on any media page to add items." />
          )}
        </div>
      )}

      {tab === "collections" &&
        !openCollection &&
        (collections.length ? (
          <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {collections.map((c) => {
              const items = resolve(c.items).slice(0, 4);
              return (
                <li key={c.id} className="group relative">
                  <button type="button" onClick={() => setParams({ c: c.id })} className="block w-full text-left">
                    <div className={cn("grid aspect-[16/10] gap-0.5 overflow-hidden rounded-xl bg-surface-2", items.length > 1 && "grid-cols-2")}>
                      {items.map((m) => (
                        <MediaThumb key={m.slug} item={m} sizes="200px" aspect="auto" className="h-full" rounded="rounded-none" showKind={false} />
                      ))}
                    </div>
                    <p className="mt-3 text-[15px] font-semibold">{c.name}</p>
                    <p className="text-[12.5px] text-muted">{pluralize(c.items.length, "item")}</p>
                  </button>
                  <div className="absolute top-2 right-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    <Menu
                      align="end"
                      items={[
                        { label: "Open", onSelect: () => setParams({ c: c.id }) },
                        { label: "Rename…", onSelect: () => setRenaming(c) },
                        { type: "separator" },
                        { label: "Delete", danger: true, onSelect: () => remove(c) },
                      ]}
                      trigger={(p) => (
                        <button {...p} type="button" aria-label={`Options for ${c.name}`} className={buttonClass({ variant: "glass", size: "icon-sm", className: "text-white" })}>
                          <MoreHorizontal />
                        </button>
                      )}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Layers />}
            title="No collections yet"
            description="Group media into your own collections — saved in this browser, no account needed."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                New collection
              </Button>
            }
          />
        ))}

      <NewCollectionDialog open={creating} onClose={() => setCreating(false)} onCreate={(name) => library.createCollection(name)} />
      <RenameDialog collection={renaming} onClose={() => setRenaming(null)} />
    </div>
  );
}

function RenameDialog({ collection, onClose }: { collection: UserCollection | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  if (collection && forId !== collection.id) {
    setForId(collection.id);
    setName(collection.name);
  }
  return (
    <Dialog open={Boolean(collection)} onClose={onClose} title="Rename collection" size="sm">
      <form
        className="px-5 pt-4 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (collection && name.trim()) library.renameCollection(collection.id, name);
          onClose();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          aria-label="Collection name"
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[14px] outline-none focus:border-border-strong"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
