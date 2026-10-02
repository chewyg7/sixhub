"use client";

import { useRef, useState } from "react";
import { FolderPlus, Plus } from "lucide-react";
import { library, useLibrary } from "@/features/library/store";
import { Button, buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu, type MenuEntry } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";

export function NewCollectionDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="New collection" description="Collections are saved in this browser." size="sm" initialFocus={input}>
      <form onSubmit={submit} className="px-5 pt-4 pb-5">
        <label className="text-[12.5px] text-muted" htmlFor="new-collection-name">
          Name
        </label>
        <input
          id="new-collection-name"
          ref={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Lucia moments"
          className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-border-strong"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function AddToCollection({
  slug,
  title,
  variant = "secondary",
  size = "md",
  iconOnly,
}: {
  slug: string;
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
}) {
  const collections = useLibrary((s) => s.collections);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const items: MenuEntry[] = [
    ...(collections.length ? [{ type: "label" as const, label: "Your collections" }] : []),
    ...collections.map((c) => ({
      label: c.name,
      checked: c.items.includes(slug),
      onSelect: () => {
        const added = library.toggleInCollection(c.id, slug);
        toast(added ? `Added to “${c.name}”` : `Removed from “${c.name}”`);
      },
    })),
    ...(collections.length ? [{ type: "separator" as const }] : []),
    { label: "New collection…", icon: <Plus />, onSelect: () => setCreating(true) },
  ];

  return (
    <>
      <Menu
        items={items}
        minWidth={220}
        trigger={(p) => (
          <button {...p} type="button" aria-label={`Add ${title} to a collection`} className={buttonClass({ variant, size })}>
            <FolderPlus />
            {!iconOnly && "Save to collection"}
          </button>
        )}
      />
      <NewCollectionDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(name) => {
          library.createCollection(name, [slug]);
          toast(`Created “${name}”`);
        }}
      />
    </>
  );
}
