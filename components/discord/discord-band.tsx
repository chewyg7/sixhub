import { DiscordIcon } from "@/components/layout/social-links";
import { getDiscordInvite } from "@/lib/discord";
import { DiscordOpening } from "./discord-opening";
import { JoinButton, OnlineDot, formatCount } from "./join-button";

/** The home page's Discord invite: a full-width band in the Discord gradient that opens as you scroll to it. */
export async function DiscordBand() {
  const discord = await getDiscordInvite();
  if (!discord) return null;
  const { invite, server } = discord;
  return (
    <DiscordOpening className="relative isolate overflow-hidden bg-[#100d1a] md:aspect-[850/169]">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,rgb(16_13_26)_20%,rgb(43_32_110/0.9)_58%,rgb(255_79_163/0.6))]" />
      <div aria-hidden className="absolute -right-32 -bottom-48 -z-10 size-[560px] rounded-full bg-[radial-gradient(closest-side,rgb(88_101_242/0.5),transparent)]" />
      {/* Depth: the page above casts a shadow into the opening, and the band sinks a little at the bottom. */}
      <div aria-hidden data-open-shade className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[linear-gradient(to_bottom,rgb(5_4_8/0.85),rgb(5_4_8/0.35)_35%,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-[linear-gradient(to_top,rgb(5_4_8/0.45),transparent)]" />

      <div className="relative mx-auto flex h-full max-w-[1600px] flex-col justify-center gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between md:py-0 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          {server?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- Discord CDN icon
            <img data-slide="left" src={server.icon} alt="" width={88} height={88} loading="lazy" className="hidden size-[clamp(56px,5.5vw,88px)] shrink-0 rounded-[26%] object-cover shadow-xl sm:block" />
          ) : (
            <span data-slide="left" className="hidden size-20 shrink-0 items-center justify-center rounded-3xl bg-[#5865F2] sm:flex">
              <DiscordIcon className="size-10 text-white" />
            </span>
          )}
          <div className="min-w-0">
            <p data-slide="left" className="display-xl text-[44px] leading-[0.9] sm:text-[clamp(44px,5vw,84px)]">
              Join the Discord
            </p>
            <p data-slide="left" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-white/70 sm:text-[16.5px]">
              {server?.members ? <span>{formatCount(server.members)} fans counting down to GTA VI</span> : <span>Fans counting down to GTA VI</span>}
              {server?.online ? (
                <span className="flex items-center gap-2">
                  <OnlineDot /> <span className="font-bold text-white">{formatCount(server.online)}</span> online
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div data-slide="right" className="shrink-0">
          <JoinButton href={invite} members={server?.members ?? null} />
        </div>
      </div>
    </DiscordOpening>
  );
}
