import type { MediaFolder } from "@/types/content";

export interface FolderOption {
  id: string;
  label: string;
  depth: number;
}

/** Folders flattened depth-first with indented labels, for <select>s. */
export function folderOptions(folders: MediaFolder[]): FolderOption[] {
  const out: FolderOption[] = [];
  const walk = (parent: string | null, depth: number, prefix: string) => {
    folders
      .filter((f) => f.parentId === parent)
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .forEach((f) => {
        const path = prefix ? `${prefix} / ${f.name}` : f.name;
        out.push({ id: f.id, label: path, depth });
        walk(f.id, depth + 1, path);
      });
  };
  walk(null, 0, "");
  return out;
}
