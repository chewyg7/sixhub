import { ArrowUpRight } from "lucide-react";
import { DiscordIcon } from "@/components/layout/social-links";
import { Magnetic } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";

export const formatCount = (n: number) => n.toLocaleString("en-US");

/** The big Discord-blue join button, with the live member count when Discord shares it. */
export function JoinButton({ href, members, size = "lg", className }: { href: string; members: number | null; size?: "lg" | "md"; className?: string }) {
  return (
    <Magnetic>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor="view"
        data-cursor-label="Join"
        className={cn(
          "group inline-flex items-center gap-3 rounded-full bg-[#5865F2] font-bold text-white shadow-[0_18px_50px_-12px_rgb(88_101_242/0.85)] transition-[transform,background-color] duration-500 hover:scale-[1.04] hover:bg-[#6b77f5] active:scale-[0.97]",
          size === "lg" ? "h-16 pr-7 pl-5 text-[18px]" : "h-12 pr-5 pl-4 text-[15.5px]",
          className,
        )}
      >
        <DiscordIcon className={cn("transition-transform duration-500 group-hover:-rotate-12", size === "lg" ? "size-7" : "size-6")} />
        Join{members ? ` ${formatCount(members)} members` : " the server"}
        <ArrowUpRight className="size-5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </Magnetic>
  );
}

/** Green "online now" pulse. */
export function OnlineDot() {
  return (
    <span className="relative flex size-2.5">
      <span className="absolute inset-0 animate-ping rounded-full bg-[#23a55a] opacity-60" />
      <span className="relative size-2.5 rounded-full bg-[#23a55a]" />
    </span>
  );
}
