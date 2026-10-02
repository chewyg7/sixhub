"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  trigger: (p: { ref: (el: HTMLElement | null) => void; onClick: () => void; "aria-expanded": boolean; "aria-controls": string; "aria-haspopup": "dialog" }) => ReactNode;
  children: (close: () => void) => ReactNode;
  placement?: "above" | "below";
  align?: "start" | "end" | "center";
  label: string;
  className?: string;
}

/** Non-modal floating panel (speed, zoom presets). Closes on outside click, Esc or blur. */
export function Popover({ trigger, children, placement = "above", align = "center", label, className }: PopoverProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerEl?.focus({ preventScroll: true });
  }, [triggerEl]);

  useLayoutEffect(() => {
    if (!open || !panel.current || !triggerEl) return;
    const t = triggerEl.getBoundingClientRect();
    const w = panel.current.offsetWidth;
    const h = panel.current.offsetHeight;
    let left = align === "start" ? t.left : align === "end" ? t.right - w : t.left + t.width / 2 - w / 2;
    let top = placement === "above" ? t.top - h - 8 : t.bottom + 8;
    if (top < 8) top = t.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, t.top - h - 8);
    left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
    setPos({ left, top });
  }, [open, placement, align, triggerEl]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !triggerEl?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, close, triggerEl]);

  return (
    <>
      {trigger({
        ref: setTriggerEl,
        onClick: () => setOpen((o) => !o),
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": "dialog",
      })}
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            className={`glass-2 fixed z-[950] animate-scale-in rounded-lg p-2 ${className ?? ""}`}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}
