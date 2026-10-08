"use client";

import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/* Building blocks for the admin panel. */

export function PageTitle({ title, description, actions, kicker }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; kicker?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className="display-xl text-[44px] text-white sm:text-[56px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, children, className, actions }: { title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:p-7", className)}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[18px] font-bold text-white">{title}</h2>}
            {description && <p className="mt-1 text-[14px] leading-relaxed text-white/55">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13.5px] font-bold text-white/85">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-[12.5px] leading-relaxed text-white/45">{hint}</span>}
      {error && <span className="mt-1.5 block text-[12.5px] text-[#ff8a9a]">{error}</span>}
    </label>
  );
}

const control =
  "w-full rounded-xl border border-white/12 bg-black/25 px-3.5 text-[14.5px] text-white outline-none transition-colors placeholder:text-white/30 hover:border-white/20 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-50";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, "h-11", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "min-h-28 py-3 leading-relaxed", props.className)} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(control, "h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", props.className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-opacity='.5' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

export function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-white/15 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
      <span>
        <span className="block text-[14px] font-bold text-white/90">{label}</span>
        {hint && <span className="block text-[12.5px] text-white/45">{hint}</span>}
      </span>
    </label>
  );
}

type Tone = "primary" | "secondary" | "ghost" | "danger";
const tones: Record<Tone, string> = {
  primary: "bg-[image:var(--sunset)] text-white shadow-[0_10px_30px_-12px_rgb(255_79_163/0.8)] hover:brightness-110",
  secondary: "bg-white/10 text-white hover:bg-white/15",
  ghost: "text-white/70 hover:bg-white/8 hover:text-white",
  danger: "bg-[#ff4d6d]/15 text-[#ff8a9a] hover:bg-[#ff4d6d]/25",
};

export function Button({ tone = "secondary", size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold transition-[background-color,filter,transform] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-11 px-5 text-[14px]",
        tones[tone],
        className,
      )}
    />
  );
}

/** Submit button that shows a spinner while its form's action is running. */
export function SubmitButton({ children, tone = "primary", className, pendingLabel }: { children: ReactNode; tone?: Tone; className?: string; pendingLabel?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" tone={tone} disabled={pending} className={className} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" | "good" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-bold whitespace-nowrap",
        tone === "neutral" && "bg-white/10 text-white/75",
        tone === "accent" && "bg-accent/20 text-accent-text",
        tone === "warn" && "bg-[#ffb84d]/15 text-[#ffcc80]",
        tone === "good" && "bg-[#4dd68c]/15 text-[#7ee8ae]",
        tone === "bad" && "bg-[#ff4d6d]/15 text-[#ff8a9a]",
      )}
    >
      {children}
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
        tone === "error" && "bg-[#ff4d6d]/12 text-[#ffb3be]",
        tone === "success" && "bg-[#4dd68c]/12 text-[#a8f0c8]",
        tone === "info" && "bg-white/[0.06] text-white/75",
      )}
    >
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/12 px-6 py-14 text-center">
      <p className="text-[16px] font-bold text-white/80">{title}</p>
      {children && <div className="mt-2 text-[14px] text-white/50">{children}</div>}
    </div>
  );
}

/** A button that asks "Are you sure?" inline before it fires. */
export function ConfirmButton({ children, confirmLabel = "Yes, do it", onConfirm, tone = "danger", size = "sm", disabled }: { children: ReactNode; confirmLabel?: ReactNode; onConfirm: () => void; tone?: Tone; size?: "sm" | "md"; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button tone={tone} size={size} onClick={() => setAsking(true)} disabled={disabled}>
        {children}
      </Button>
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        tone="danger"
        size={size}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button tone="ghost" size={size} onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </span>
  );
}

export { formatTime } from "./format";
