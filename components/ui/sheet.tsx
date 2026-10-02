"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { lockScroll, useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { IconButton } from "./icon-button";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** `bottom` for mobile tool sheets, `left`/`right` for drawers. */
  side?: "bottom" | "left" | "right";
  className?: string;
  headerExtra?: ReactNode;
  /** Keep the page behind interactive (viewer sheets leave media visible). */
  modal?: boolean;
}

/**
 * Bottom sheet / side drawer. The bottom variant can be dismissed by
 * dragging its handle down.
 */
export function Sheet({ open, onClose, title, children, side = "bottom", className, headerExtra, modal = true }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  useFocusTrap(ref, open && modal);

  useEffect(() => {
    if (!open) return;
    const unlock = modal ? lockScroll() : () => {};
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, modal]);

  if (!open) return null;

  const onHandleDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (dragStart.current == null) return;
    setDrag(Math.max(0, e.clientY - dragStart.current));
  };
  const onHandleUp = () => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    if (drag > 90) onClose();
    setDrag(0);
  };

  const panel =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[82dvh] rounded-t-2xl animate-sheet-in pb-[env(safe-area-inset-bottom)]"
      : side === "left"
        ? "inset-y-0 left-0 w-[min(88vw,380px)] animate-fade-in"
        : "inset-y-0 right-0 w-[min(88vw,380px)] animate-fade-in";

  return createPortal(
    <div className="fixed inset-0 z-[850]">
      {modal && <div className="absolute inset-0 animate-fade-in bg-[var(--scrim)]" onClick={onClose} aria-hidden />}
      <div
        ref={ref}
        role="dialog"
        aria-modal={modal}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("glass-3 absolute flex flex-col overflow-hidden outline-none", panel, className)}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
      >
        {side === "bottom" && (
          <div
            className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            aria-hidden
          >
            <span className="h-1 w-9 rounded-full bg-border-strong" />
          </div>
        )}
        <div className={cn("flex items-center justify-between gap-3 px-4", side === "bottom" ? "pb-2" : "py-3")}>
          <h2 id={titleId} className="text-[14px] font-semibold">
            {title}
          </h2>
          <div className="flex items-center gap-1">
            {headerExtra}
            <IconButton label="Close" size="icon-sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
