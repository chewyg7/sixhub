import Link from "next/link";
import { DiscordIcon } from "@/components/layout/social-links";
import { SplitReveal } from "@/components/motion/reveal";
import { getDiscordInvite } from "@/lib/discord";
import { JoinButton, OnlineDot, formatCount } from "./join-button";

const PERKS = ["Trailer and screenshot talk", "Theories and the countdown", "All things Rockstar", "Gaming, memes and chat"];

/** The home page's Discord invite: the server's banner, live counts and a big join button. */
export async function DiscordBand() {
  const discord = await getDiscordInvite();
  if (!discord) return null;
  const { invite, server } = discord;
  return (
    <section aria-labelledby="discord-h" className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#100d1a] shadow-[0_40px_120px_-40px_rgb(88_101_242/0.55)]">
      {server?.banner && (
        // eslint-disable-next-line @next/next/no-img-element -- Discord CDN banner
        <img src={server.banner} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-30" />
      )}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(110deg,rgb(16_13_26)_25%,rgb(43_32_110/0.85)_60%,rgb(255_79_163/0.55))]" />
      <div aria-hidden className="absolute -right-24 -bottom-32 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(88_101_242/0.55),transparent)]" />

      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-14">
        <div className="min-w-0">
          <p className="kicker mb-4 flex items-center gap-2 text-[#c3c8ff]">
            <DiscordIcon className="size-4" /> {server?.name ?? "GTA 6 Hub"} on Discord
          </p>
          <SplitReveal id="discord-h" by="words" className="display-xl max-w-3xl text-[46px] leading-[0.9] sm:text-[84px]">
            {server?.members ? `Count down with ${formatCount(server.members)} fans` : "Count down with the community"}
          </SplitReveal>
          <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-white/75">
            {server?.description ?? "The GTA 6 Hub community: every trailer, screenshot and rumour, talked through with people who care as much as you do."}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {PERKS.map((p) => (
              <li key={p} className="inline-flex h-9 items-center rounded-full bg-white/[0.08] px-3.5 text-[14px] font-bold text-white/85 backdrop-blur-md">
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-start gap-5 lg:items-end">
          {server?.icon && (
            // eslint-disable-next-line @next/next/no-img-element -- Discord CDN icon
            <img src={server.icon} alt="" width={96} height={96} loading="lazy" className="hidden size-24 rounded-[28px] border-4 border-white/10 object-cover shadow-xl lg:block" />
          )}
          {server?.online ? (
            <p className="flex items-center gap-2 text-[15px]">
              <OnlineDot />
              <span className="font-bold">{formatCount(server.online)}</span> <span className="text-white/60">online right now</span>
            </p>
          ) : null}
          <JoinButton href={invite} members={server?.members ?? null} />
          <Link href="/discord" className="text-[14px] font-semibold text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline">
            What goes on in there
          </Link>
        </div>
      </div>
    </section>
  );
}
