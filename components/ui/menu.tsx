"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";

export type MenuEntry =
  | {
      type?: "item";
      label: string;
      icon?: ReactNode;
      shortcut?: string;
      onSelect: () => void;
      checked?: boolean;
      disabled?: boolean;
      danger?: boolean;
      href?: string;
    }
  | { type: "separator" }
  | { type: "label"; label: string };

interface MenuListProps {
  items: MenuEntry[];
  onClose: () => void;
  /** Anchor rect or point. */
  anchor: { x: number; y: number; width?: number; height?: number };
  align?: "start" | "end";
  placement?: "below" | "above";
  labelledBy?: string;
  minWidth?: number;
}

/** Floating menu with full keyboard support (arrows, Home/End, typeahead, Esc). */
export function MenuList({ items, onClose, anchor, align = "start", placement = "below", labelledBy, minWidth = 200 }: MenuListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const typeahead = useRef({ text: "", t: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const aw = anchor.width ?? 0;
    const ah = anchor.height ?? 0;
    let left = align === "end" ? anchor.x + aw - w : anchor.x;
    let top = placement === "above" ? anchor.y - h - 6 : anchor.y + ah + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, anchor.y - h - 6);
    if (top < 8) top = 8;
    left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
    setPos({ left, top });
  }, [anchor, align, placement]);

  const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => focusables()[0]?.focus());
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onResize = () => onClose();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onResize);
    };
  }, [onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = focusables();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typeahead.current.text = now - typeahead.current.t > 600 ? e.key.toLowerCase() : typeahead.current.text + e.key.toLowerCase();
      typeahead.current.t = now;
      list.find((el) => el.textContent?.trim().toLowerCase().startsWith(typeahead.current.text))?.focus();
    }
    e.stopPropagation();
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="glass-2 fixed z-[950] max-h-[70vh] animate-scale-in overflow-y-auto rounded-lg p-1 outline-none"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, minWidth, transformOrigin: placement === "above" ? "bottom" : "top" }}
    >
      {items.map((item, i) => {
        if (item.type === "separator") return <div key={i} role="separator" className="my-1 h-px bg-divider" />;
        if (item.type === "label")
          return (
            <div key={i} className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
              {item.label}
            </div>
          );
        const isCheck = item.checked !== undefined;
        return (
          <button
            key={i}
            type="button"
            role={isCheck ? "menuitemradio" : "menuitem"}
            aria-checked={isCheck ? item.checked : undefined}
            aria-disabled={item.disabled || undefined}
            tabIndex={-1}
            onClick={() => {
              if (item.disabled) return;
              onClose();
              item.onSelect();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[13px] transition-colors duration-100 outline-none hover:bg-surface-hover focus:bg-surface-hover [&_svg]:size-4 [&_svg]:text-muted",
              item.danger ? "text-danger" : "text-text",
              item.disabled && "opacity-40",
            )}
          >
            {isCheck ? <span className="flex size-4 items-center justify-center">{item.checked && <Check />}</span> : item.icon}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

interface MenuProps {
  items: MenuEntry[];
  align?: "start" | "end";
  placement?: "below" | "above";
  minWidth?: number;
  /** Render-prop trigger so any button can open the menu. */
  trigger: (props: {
    ref: (el: HTMLElement | null) => void;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls"?: string;
    id: string;
  }) => ReactNode;
}

export function Menu({ items, align, placement, minWidth, trigger }: MenuProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
  const id = useId();
  const close = useCallback(() => {
    setAnchor(null);
    triggerEl?.focus({ preventScroll: true });
  }, [triggerEl]);
  return (
    <>
      {trigger({
        ref: setTriggerEl,
        onClick: () => (anchor ? setAnchor(null) : setAnchor(triggerEl?.getBoundingClientRect() ?? null)),
        "aria-haspopup": "menu",
        "aria-expanded": Boolean(anchor),
        id,
      })}
      {anchor && (
        <MenuList
          items={items}
          onClose={close}
          anchor={{ x: anchor.left, y: anchor.top, width: anchor.width, height: anchor.height }}
          align={align}
          placement={placement}
          labelledBy={id}
          minWidth={minWidth}
        />
      )}
    </>
  );
}

/** Right-click (and long-press) context menu around arbitrary content. */
export function useContextMenu() {
  const [state, setState] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const open = useCallback((e: { clientX: number; clientY: number; preventDefault: () => void }, items: MenuEntry[]) => {
    e.preventDefault();
    setState({ x: e.clientX, y: e.clientY, items });
  }, []);
  const close = useCallback(() => setState(null), []);
  const element = state ? <MenuList items={state.items} onClose={close} anchor={{ x: state.x, y: state.y }} /> : null;
  return { open, close, element };
}
