"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { Kbd } from "./kbd";

interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  children: ReactElement<Record<string, unknown>>;
  disabled?: boolean;
}

interface Pos {
  x: number;
  y: number;
  side: NonNullable<TooltipProps["side"]>;
}

/** Assign a node to a ref of either kind. Module-level so it never runs during render. */
function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref && typeof ref === "object") (ref as { current: T | null }).current = node;
}

/**
 * Lightweight tooltip rendered in a portal so it is never clipped by
 * scrolling panels. Shows on hover (after a delay) and on keyboard focus.
 * The trigger keeps its own aria-label; the tooltip is supplementary and
 * linked via aria-describedby.
 */
export function Tooltip({ content, shortcut, side = "top", delay = 450, children, disabled }: TooltipProps) {
  const id = useId();
  const [pos, setPos] = useState<Pos | null>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(
    (immediate: boolean) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(
        () => {
          if (!trigger) return;
          const r = trigger.getBoundingClientRect();
          let s = side;
          if (s === "top" && r.top < 44) s = "bottom";
          if (s === "bottom" && window.innerHeight - r.bottom < 44) s = "top";
          const x = s === "left" ? r.left - 8 : s === "right" ? r.right + 8 : r.left + r.width / 2;
          const y = s === "top" ? r.top - 8 : s === "bottom" ? r.bottom + 8 : r.top + r.height / 2;
          setPos({ x, y, side: s });
        },
        immediate ? 0 : delay,
      );
    },
    [delay, side, trigger],
  );

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos, hide]);

  // React 19: `ref` is a regular prop; keep the child's own ref working.
  const childRef = isValidElement(children) ? (children.props as { ref?: Ref<HTMLElement> }).ref : undefined;
  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      setTrigger(node);
      assignRef(childRef, node);
    },
    [childRef],
  );

  if (!isValidElement(children) || disabled) return children;

  const childProps = children.props as Record<string, (e: unknown) => void>;
  // eslint-disable-next-line react-hooks/refs -- attaches a merged ref callback; no ref is read during render
  const cloned = cloneElement(children, {
    ref: mergedRef,
    "aria-describedby": pos ? id : undefined,
    onPointerEnter: (e: PointerEvent) => {
      childProps.onPointerEnter?.(e);
      if (e.pointerType === "mouse") show(false);
    },
    onPointerLeave: (e: unknown) => {
      childProps.onPointerLeave?.(e);
      hide();
    },
    onPointerDown: (e: unknown) => {
      childProps.onPointerDown?.(e);
      hide();
    },
    onFocus: (e: FocusEvent) => {
      childProps.onFocus?.(e);
      const target = e.target as HTMLElement;
      if (target.matches?.(":focus-visible")) show(true);
    },
    onBlur: (e: unknown) => {
      childProps.onBlur?.(e);
      hide();
    },
  });

  const transform =
    pos?.side === "top" ? "translate(-50%, -100%)" : pos?.side === "bottom" ? "translate(-50%, 0)" : pos?.side === "left" ? "translate(-100%, -50%)" : "translate(0, -50%)";

  return (
    <>
      {cloned}
      {pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="glass-3 pointer-events-none fixed z-[1000] flex animate-fade-in items-center gap-2 rounded-md px-2 py-1 text-[12px] font-medium text-text"
            style={{ left: pos.x, top: pos.y, transform }}
          >
            {content}
            {shortcut && <Kbd>{shortcut}</Kbd>}
          </div>,
          document.body,
        )}
    </>
  );
}
