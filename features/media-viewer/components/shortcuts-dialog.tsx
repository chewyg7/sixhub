"use client";

import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useIsMac } from "@/lib/hooks/use-client";
import { useViewer } from "../store";
import { SHORTCUTS, type Shortcut } from "../shortcuts";

const GROUPS: Shortcut["group"][] = ["Playback", "View", "Tools", "Panels"];

export function ShortcutsDialog() {
  const open = useViewer((s) => s.shortcutsOpen);
  const set = useViewer((s) => s.set);
  const isMac = useIsMac();
  return (
    <Dialog open={open} onClose={() => set({ shortcutsOpen: false })} title="Keyboard shortcuts" description="Shortcuts work whenever you're not typing in a field." size="xl">
      <div className="grid gap-x-10 gap-y-6 px-5 pt-4 pb-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g} aria-labelledby={`sc-${g}`}>
            <h3 id={`sc-${g}`} className="eyebrow mb-2">
              {g}
            </h3>
            <dl className="divide-y divide-divider">
              {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4 py-1.5">
                  <dt className="text-[13px] text-muted">{s.label}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {s.keys.map((key) => (
                      <Kbd key={key}>{key === "Ctrl" && isMac ? "⌘" : key}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
