import { cn } from "@/lib/cn";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border-strong bg-surface-2 px-1 font-mono text-[10.5px] leading-none font-medium text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
