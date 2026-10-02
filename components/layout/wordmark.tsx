import Link from "next/link";
import { cn } from "@/lib/cn";

/** The GTA 6 Hub logo, linking home. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="GTA 6 Hub home" className={cn("group inline-flex items-center rounded-lg outline-offset-4", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
      <img src="/brand/logo-480.webp" alt="" width={480} height={335} className="h-8 w-auto transition-transform duration-500 group-hover:-rotate-6" />
    </Link>
  );
}
