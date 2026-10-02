"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { lockScroll, useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { IconButton } from "./icon-button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Hide the visual title (still announced to screen readers). */
  hideTitle?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  /** Position near the top (command palette style) instead of centered. */
  placement?: "center" | "top";
  footer?: ReactNode;
}

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

export function Dialog({ open, onClose, title, description, children, size = "md", hideTitle, initialFocus, className, placement = "center", footer }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, open, initialFocus);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
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
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={cn("fixed inset-0 z-[900] flex justify-center px-4", placement === "top" ? "items-start pt-[12vh]" : "items-center py-6")}>
      <div className="absolute inset-0 animate-fade-in bg-[var(--scrim)]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn("glass-3 relative flex max-h-full w-full animate-scale-in flex-col overflow-hidden rounded-xl outline-none", SIZES[size], className)}
      >
        <div className={cn("flex items-start justify-between gap-4 px-5 pt-4", hideTitle && "sr-only")}>
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold text-text">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-[13px] text-muted">
                {description}
              </p>
            )}
          </div>
          {!hideTitle && (
            <IconButton label="Close" size="icon-sm" onClick={onClose} className="-mt-1 -mr-2">
              <X />
            </IconButton>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-divider px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
