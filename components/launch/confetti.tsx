"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { prefersLofi } from "@/lib/preferences";

/**
 * Full-screen confetti. Fire it from anywhere with
 * `window.dispatchEvent(new CustomEvent("gh:confetti", { detail: { intensity } }))`.
 * Paper tumbles (its width follows a flip phase), ribbons flutter, and the
 * canvas stops drawing once the last piece has fallen.
 */
const COLORS = ["#ff4fa3", "#e445b8", "#ff8a73", "#ffd36e", "#8b6bff", "#5fd6ff", "#ffffff"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  flip: number;
  vflip: number;
  w: number;
  h: number;
  color: string;
  shape: 0 | 1 | 2; // paper, ribbon, dot
  life: number;
}

export function fireConfetti(intensity = 1) {
  window.dispatchEvent(new CustomEvent("gh:confetti", { detail: { intensity } }));
}

export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let pieces: Piece[] = [];
    let raf = 0;
    let last = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (n: number, x: number, y: number, angle: number, spread: number, speed: number) => {
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const v = speed * (0.55 + Math.random() * 0.65);
        const shape = (Math.random() < 0.18 ? 1 : Math.random() < 0.12 ? 2 : 0) as Piece["shape"];
        pieces.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.35,
          flip: Math.random() * Math.PI * 2,
          vflip: 0.08 + Math.random() * 0.18,
          w: shape === 1 ? 4 + Math.random() * 3 : 7 + Math.random() * 7,
          h: shape === 1 ? 18 + Math.random() * 16 : 5 + Math.random() * 6,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          shape,
          life: 1,
        });
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(2.5, (t - (last || t)) / 16.67);
      last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const next: Piece[] = [];
      for (const p of pieces) {
        p.vy += 0.32 * dt;
        p.vx *= Math.pow(0.985, dt);
        p.vy *= Math.pow(0.988, dt);
        p.vx += Math.sin(p.flip * 0.7) * 0.06 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vflip * dt;
        if (p.y > innerHeight + 60) continue;
        if (p.y > innerHeight * 0.85) p.life -= 0.02 * dt;
        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 2) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Tumbling: the visible width follows the flip phase; the back face is darker.
          const sx = Math.cos(p.flip);
          ctx.scale(sx, 1);
          if (sx < 0) ctx.filter = "brightness(0.7)";
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
        next.push(p);
      }
      pieces = next;
      raf = pieces.length ? requestAnimationFrame(frame) : 0;
      if (!pieces.length) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const onFire = (e: Event) => {
      if (prefersReducedMotion()) return;
      const k = Math.max(0.3, Math.min(2, (e as CustomEvent<{ intensity?: number }>).detail?.intensity ?? 1));
      const w = innerWidth;
      const h = innerHeight;
      const n = Math.round((w < 640 ? 70 : 140) * k * (prefersLofi() ? 0.45 : 1));
      // Two side cannons and a burst from the top.
      spawn(n, -10, h * 0.78, -Math.PI / 3.2, 0.7, 26);
      spawn(n, w + 10, h * 0.78, -Math.PI + Math.PI / 3.2, 0.7, 26);
      spawn(Math.round(n * 0.8), w / 2, -20, Math.PI / 2, 2.4, 9);
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    window.addEventListener("gh:confetti", onFire);
    return () => {
      window.removeEventListener("gh:confetti", onFire);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[1200] h-full w-full" />;
}
