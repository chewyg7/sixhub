"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<(message: string, opts?: { tone?: Tone; action?: Toast["action"]; duration?: number }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, opts: { tone?: Tone; action?: Toast["action"]; duration?: number } = {}) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts.tone ?? "success", action: opts.action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration ?? 2600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-4 z-[1100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="glass-3 pointer-events-auto flex animate-rise-in items-center gap-2.5 rounded-lg py-2 pr-2 pl-3 text-[13px] text-text">
            <span className={cn("[&_svg]:size-4", t.tone === "success" ? "text-positive" : t.tone === "error" ? "text-danger" : "text-muted")}>
              {t.tone === "success" ? <Check /> : t.tone === "error" ? <CircleAlert /> : <Info />}
            </span>
            <span className="pr-1">{t.message}</span>
            {t.action && (
              <button type="button" onClick={t.action.onClick} className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-accent-text hover:bg-surface-hover">
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
