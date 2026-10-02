import type { ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("skeleton", className)} style={style} />;
}

interface StateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-16",
        className,
      )}
    >
      {icon && <div className="text-faint [&_svg]:size-6">{icon}</div>}
      <div className="max-w-md">
        <p className="text-[14px] font-semibold text-text">{title}</p>
        {description && <div className="mt-1 text-[13px] leading-relaxed text-muted">{description}</div>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retrying,
  className,
  compact,
}: Omit<StateProps, "action" | "icon" | "title"> & { title?: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-danger/25 bg-danger/[0.04] text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <div className="max-w-md">
        <p className="text-[14px] font-semibold text-text">{title}</p>
        {description && <div className="mt-1 text-[13px] leading-relaxed text-muted">{description}</div>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-1 inline-flex h-8 items-center gap-2 rounded-md bg-surface-3 px-3 text-[13px] font-medium text-text transition-colors hover:bg-surface-hover disabled:opacity-50"
        >
          <RotateCw className={cn("size-3.5", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Try again"}
        </button>
      )}
    </div>
  );
}
