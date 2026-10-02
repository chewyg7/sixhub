"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Segmented control (radio group)                                      */
/* ------------------------------------------------------------------ */
interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
  stretch?: boolean;
}

export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className, stretch }: SegmentedProps<T>) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      onChange(options[(i + 1) % options.length].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      onChange(options[(i - 1 + options.length) % options.length].value);
    }
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cn("inline-flex rounded-md bg-surface-2 p-0.5", stretch && "flex w-full", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[5px] font-medium transition-[background-color,color,box-shadow] duration-150 [&_svg]:size-4",
              size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-3 text-[13px]",
              stretch && "flex-1",
              active ? "bg-surface-hover text-text shadow-[inset_0_1px_0_var(--glass-highlight),0_1px_2px_rgb(0_0_0/0.25)]" : "text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */
export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[13px] text-text">{label}</span>
        {description && <span className="block text-[12px] text-faint">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200", checked ? "bg-text" : "bg-surface-active")}
      >
        <span
          className={cn(
            "absolute top-[2px] size-[14px] rounded-full transition-[left,background-color] duration-200 ease-[var(--ease-out)]",
            checked ? "left-[16px] bg-bg" : "left-[2px] bg-muted",
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Native select, styled                                               */
/* ------------------------------------------------------------------ */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <select
        className="h-8 w-full cursor-pointer appearance-none rounded-md border border-border bg-surface-2 pr-8 pl-2.5 text-[13px] text-text transition-colors hover:border-border-strong focus-visible:outline-2"
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Labeled slider                                                      */
/* ------------------------------------------------------------------ */
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  defaultValue?: number;
  className?: string;
}

export function Slider({ label, value, min, max, step = 1, onChange, format, defaultValue, className }: SliderProps) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  const changed = defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-9;
  return (
    <div className={cn("group/slider", className)}>
      <div className="mb-0.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[12.5px] text-muted">
          {label}
        </label>
        <button
          type="button"
          onClick={() => defaultValue !== undefined && onChange(defaultValue)}
          disabled={!changed}
          title={changed ? "Reset" : undefined}
          className={cn("tabular rounded px-1 font-mono text-[11.5px]", changed ? "text-text hover:bg-surface-hover" : "text-faint")}
        >
          {format ? format(value) : value}
        </button>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "sample" | "outline"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-[5px] px-1.5 text-[11px] leading-none font-semibold tracking-[0.02em] whitespace-nowrap",
        tone === "neutral" && "bg-surface-3 text-muted",
        tone === "accent" && "bg-accent-soft text-accent-text",
        tone === "sample" && "bg-warning/12 text-warning",
        tone === "outline" && "border border-border-strong text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
