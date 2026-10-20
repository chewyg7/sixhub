import { ArrowUpRight } from "lucide-react";
import { DiscordIcon } from "@/components/layout/social-links";
import { getDiscordInvite } from "@/lib/discord";
import { OnlineDot, formatCount } from "./join-button";

/** A slim join prompt for the bottom of pages (and the footer). */
export async function DiscordStrip({ className }: { className?: string }) {
  const discord = await getDiscordInvite();
  if (!discord) return null;
  const { invite, server } = discord;
  return (
    <a
      href={invite}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex flex-col gap-4 overflow-hidden rounded-[28px] border border-[#5865F2]/30 bg-[linear-gradient(110deg,rgb(88_101_242/0.18),rgb(255_79_163/0.10))] p-5 transition-[border-color,transform] duration-500 hover:-translate-y-0.5 hover:border-[#5865F2]/70 sm:flex-row sm:items-center sm:p-6 ${className ?? ""}`}
    >
      {server?.icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- Discord CDN icon
        <img src={server.icon} alt="" width={56} height={56} loading="lazy" className="size-14 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#5865F2]">
          <DiscordIcon className="size-7 text-white" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] font-bold text-white">
          Join {server?.members ? `${formatCount(server.members)} GTA VI fans` : "the GTA 6 Hub community"} on Discord
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[14px] text-white/60">
          {server?.online ? (
            <>
              <OnlineDot /> {formatCount(server.online)} online now ·
            </>
          ) : null}{" "}
          Trailers, theories and the countdown to launch.
        </span>
      </span>
      <span className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-full bg-[#5865F2] px-5 text-[15px] font-bold text-white transition-colors group-hover:bg-[#6b77f5] sm:self-center">
        <DiscordIcon className="size-5" /> Join the server <ArrowUpRight className="size-4" />
      </span>
    </a>
  );
}
