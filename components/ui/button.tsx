import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "glass" | "outline" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium leading-none transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-text hover:bg-primary-hover",
  secondary: "bg-surface-3 text-text hover:bg-surface-hover active:bg-surface-active",
  ghost: "text-muted hover:bg-surface-hover hover:text-text active:bg-surface-active",
  glass: "glass-1 text-text hover:bg-[color-mix(in_srgb,var(--glass-1)_60%,var(--surface-hover))]",
  outline: "border border-border-strong text-text hover:bg-surface-hover",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 rounded-sm px-2.5 text-[12px] [&_svg]:size-3.5",
  sm: "h-8 rounded-md px-3 text-[13px] [&_svg]:size-4",
  md: "h-9 rounded-md px-3.5 text-[13.5px] [&_svg]:size-4",
  lg: "h-11 rounded-lg px-5 text-[14.5px] [&_svg]:size-[18px]",
  "icon-xs": "size-7 rounded-sm [&_svg]:size-3.5",
  "icon-sm": "size-8 rounded-md [&_svg]:size-4",
  icon: "size-9 rounded-md [&_svg]:size-[18px]",
  "icon-lg": "size-11 rounded-lg [&_svg]:size-5",
};

export function buttonClass({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Visually "on" state for toggle buttons. */
  pressed?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant, size, className, pressed, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      className={buttonClass({ variant, size, className: cn(pressed && "bg-surface-active text-text", className) })}
      {...props}
    />
  );
});

type LinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant, size, className, ...props }: LinkProps) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}

export function ButtonAnchor({ variant, size, className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={buttonClass({ variant, size, className })} {...props} />;
}
