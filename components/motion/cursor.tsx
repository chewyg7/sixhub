"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap, prefersReducedMotion } from "@/lib/motion";

type Mode = "default" | "link" | "view" | "play" | "drag" | "text" | "hidden";

/**
 * Custom cursor: a precise dot plus a trailing ring. The ring grows over
 * interactive elements and becomes a labelled bubble over media
 * (`data-cursor="view|play|drag"`, optional `data-cursor-label`).
 */
export function Cursor() {
  const path = usePathname();
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);
  const disabledRoute = path.startsWith("/viewer") || path.startsWith("/chewy");

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability is only known in the browser
    setEnabled(fine && !prefersReducedMotion() && !disabledRoute);
  }, [disabledRoute]);

  useEffect(() => {
    if (!enabled || !dot.current || !ring.current) return;
    document.documentElement.classList.add("has-cursor");
    const dx = gsap.quickTo(dot.current, "x", { duration: 0.12, ease: "power3.out" });
    const dy = gsap.quickTo(dot.current, "y", { duration: 0.12, ease: "power3.out" });
    const rx = gsap.quickTo(ring.current, "x", { duration: 0.55, ease: "power3.out" });
    const ry = gsap.quickTo(ring.current, "y", { duration: 0.55, ease: "power3.out" });
    let mode: Mode = "default";
    let visible = false;

    const apply = (next: Mode, text?: string) => {
      if (next === mode && !text) return;
      mode = next;
      const big = next === "view" || next === "play" || next === "drag";
      gsap.to(ring.current, {
        width: big ? 96 : next === "link" ? 58 : next === "text" ? 4 : 36,
        height: big ? 96 : next === "link" ? 58 : next === "text" ? 30 : 36,
        backgroundColor: big ? "rgba(255,79,163,0.92)" : next === "link" ? "rgba(255,79,163,0.14)" : "rgba(255,79,163,0)",
        borderColor: big ? "rgba(255,79,163,0)" : "rgba(255,124,188,0.75)",
        borderRadius: next === "text" ? 2 : 999,
        duration: 0.45,
        ease: "expo.out",
      });
      gsap.to(dot.current, { scale: big || next === "text" ? 0 : 1, duration: 0.3 });
      if (label.current) {
        label.current.textContent = text ?? (next === "play" ? "Play" : next === "drag" ? "Drag" : next === "view" ? "View" : "");
        gsap.to(label.current, { opacity: big ? 1 : 0, scale: big ? 1 : 0.6, duration: 0.35 });
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!visible) {
        visible = true;
        gsap.set([dot.current, ring.current], { x: e.clientX, y: e.clientY });
        gsap.to([dot.current, ring.current], { opacity: 1, duration: 0.3 });
      }
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      const custom = t.closest<HTMLElement>("[data-cursor]");
      if (custom) return apply(custom.dataset.cursor as Mode, custom.dataset.cursorLabel);
      if (t.closest("input, textarea, [contenteditable=true]")) return apply("text");
      if (t.closest("a, button, [role=button], [role=tab], [role=slider], label, select, summary")) return apply("link");
      apply("default");
    };
    const onDown = () => gsap.to(ring.current, { scale: 0.82, duration: 0.2 });
    const onUp = () => gsap.to(ring.current, { scale: 1, duration: 0.5, ease: "elastic.out(1,0.5)" });
    const onLeave = () => {
      visible = false;
      gsap.to([dot.current, ring.current], { opacity: 0, duration: 0.3 });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[3000]">
      <div
        ref={ring}
        className="absolute top-0 left-0 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,124,188,0.75)] opacity-0"
      >
        <span ref={label} className="text-[13px] font-bold text-white opacity-0" />
      </div>
      <div ref={dot} className="absolute top-0 left-0 size-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0" />
    </div>
  );
}
