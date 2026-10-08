import type { Metadata } from "next";
import { ArrowUpRight, Gamepad2, MessagesSquare, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/page";
import { DiscordIcon } from "@/components/layout/social-links";
import { Magnetic, SplitReveal, Stagger } from "@/components/motion/reveal";
import { getSettings } from "@/lib/content";
import { getDiscordServer, inviteCode } from "@/lib/discord";

// Member counts refresh every 5 minutes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Discord",
  description: "Join the GTA 6 Hub Discord: thousands of fans talking GTA VI, Rockstar and everything else.",
  alternates: { canonical: "/discord" },
};

const fmt = (n: number) => n.toLocaleString("en-US");

const REASONS = [
  { icon: Gamepad2, title: "Talk GTA VI", body: "Trailers, screenshots, theories and the countdown to launch day, with fans who care as much as you do." },
  { icon: Sparkles, title: "All things Rockstar", body: "GTA, Red Dead and the rest of Rockstar’s worlds. If it’s Rockstar, it’s on topic." },
  { icon: MessagesSquare, title: "And everything else", body: "Gaming, memes and plain chatting. Plenty happens outside the GTA channels too." },
];

function JoinButton({ href, members }: { href: string; members: number | null }) {
  return (
    <Magnetic>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor="view"
        data-cursor-label="Join"
        className="group inline-flex h-16 items-center gap-3 rounded-full bg-[#5865F2] pr-7 pl-5 text-[18px] font-bold text-white shadow-[0_18px_50px_-12px_rgb(88_101_242/0.85)] transition-[transform,background-color] duration-500 hover:scale-[1.04] hover:bg-[#6b77f5] active:scale-[0.97]"
      >
        <DiscordIcon className="size-7 transition-transform duration-500 group-hover:-rotate-12" />
        Join{members ? ` ${fmt(members)} members` : " the server"}
        <ArrowUpRight className="size-5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </Magnetic>
  );
}

export default async function DiscordPage() {
  const { socials } = await getSettings();
  const invite = socials.discord;
  const code = invite ? inviteCode(invite) : null;
  const server = code ? await getDiscordServer(code) : null;
  const name = server?.name ?? "GTA 6 Hub";

  return (
    <Container className="max-w-[1120px]">
      {/* Server card */}
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-[0_40px_120px_-40px_rgb(88_101_242/0.45)]">
        <div className="relative aspect-[16/9] max-h-[420px] w-full overflow-hidden bg-[linear-gradient(120deg,#2b1640,#5865F2_60%,#ff4fa3)] sm:aspect-[16/6]">
          {server?.banner && (
            // eslint-disable-next-line @next/next/no-img-element -- Discord CDN banner
            <img src={server.banner} alt="" className="size-full object-cover" fetchPriority="high" />
          )}
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(14_11_20)_0%,rgb(14_11_20/0.35)_45%,transparent)]" />
        </div>

        <div className="relative -mt-12 px-5 pb-8 sm:-mt-24 sm:px-10 sm:pb-10">
          <div className="flex flex-wrap items-end gap-5">
            {server?.icon ? (
              // eslint-disable-next-line @next/next/no-img-element -- Discord CDN icon
              <img src={server.icon} alt="" width={128} height={128} className="size-24 rounded-[28px] border-4 border-[#0e0b14] bg-[#0e0b14] object-cover shadow-xl sm:size-32 sm:rounded-[32px]" />
            ) : (
              <span className="flex size-28 items-center justify-center rounded-[32px] border-4 border-[#0e0b14] bg-[#5865F2] sm:size-32">
                <DiscordIcon className="size-14 text-white" />
              </span>
            )}
            <div className="min-w-0 pb-1">
              <p className="kicker mb-2 flex items-center gap-2">
                <DiscordIcon className="size-4" /> Official Discord server
              </p>
              <h1 className="display-xl flex flex-wrap items-center gap-3 text-[52px] leading-[0.9] sm:text-[76px]">
                {name}
                {server?.tag && <span className="rounded-xl bg-white/12 px-3 py-1 font-sans text-[20px] tracking-normal sm:text-[24px]">{server.tag}</span>}
              </h1>
            </div>
          </div>

          {(server?.members || server?.online) && (
            <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[15px]">
              {server.online ? (
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#23a55a] opacity-60" />
                    <span className="relative size-2.5 rounded-full bg-[#23a55a]" />
                  </span>
                  <dt className="sr-only">Online now</dt>
                  <dd>
                    <span className="font-bold">{fmt(server.online)}</span> <span className="text-white/55">online</span>
                  </dd>
                </div>
              ) : null}
              {server.members ? (
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-white/35" />
                  <dt className="sr-only">Members</dt>
                  <dd>
                    <span className="font-bold">{fmt(server.members)}</span> <span className="text-white/55">members</span>
                  </dd>
                </div>
              ) : null}
              {server.boosts > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[#ff73fa]">◆</span>
                  <dt className="sr-only">Boosts</dt>
                  <dd>
                    <span className="font-bold">{server.boosts} boosts</span>
                    {server.boostTier > 0 && <span className="text-white/55"> · level {server.boostTier}</span>}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/75">
            {server?.description ?? "A community for anything Rockstar Games related, from GTA VI to everything else people are talking about."}
          </p>

          {server && server.traits.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {server.traits.map((t) => (
                <li key={t.label} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-[14px] font-bold text-white/85">
                  {t.emoji && <span aria-hidden>{t.emoji}</span>}
                  {t.label}
                </li>
              ))}
            </ul>
          )}

          {invite && (
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <JoinButton href={invite} members={server?.members ?? null} />
              <span className="font-mono text-[14px] text-white/45">{invite.replace(/^https?:\/\//, "")}</span>
            </div>
          )}
        </div>
      </section>

      {/* Why join */}
      <section aria-labelledby="why" className="mt-24 sm:mt-32">
        <SplitReveal id="why" className="display-xl text-[48px] leading-[0.9] sm:text-[72px]">
          What goes on in there
        </SplitReveal>
        <Stagger as="ul" className="mt-10 grid gap-4 md:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-7 transition-[background-color,border-color,transform] duration-500 hover:-translate-y-1 hover:border-[#5865F2]/50 hover:bg-white/[0.05]">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#5865F2]/20 text-[#a5adff]">
                <Icon className="size-6" />
              </span>
              <p className="display mt-5 text-[24px]">{title}</p>
              <p className="mt-2 text-[15.5px] leading-relaxed text-white/60">{body}</p>
            </li>
          ))}
        </Stagger>
      </section>

      {/* Closing call to action */}
      {invite && (
        <section className="relative mt-24 overflow-hidden rounded-[36px] bg-[linear-gradient(120deg,#3b2a8f,#5865F2_55%,#ff4fa3)] px-6 py-14 text-center sm:mt-32 sm:px-10 sm:py-20">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_120%,rgb(255_255_255/0.25),transparent_70%)]" />
          <div className="relative">
            <p className="display-xl text-[44px] leading-[0.9] sm:text-[80px]">See you in there</p>
            <p className="mx-auto mt-4 max-w-md text-[16px] text-white/80">
              {server?.online ? `${fmt(server.online)} people are online right now.` : "Pull up and say hi."}
            </p>
            <div className="mt-8 flex justify-center">
              <a
                href={invite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-14 items-center gap-3 rounded-full bg-white px-7 text-[17px] font-bold text-[#2b2f8f] transition-transform duration-500 hover:scale-[1.05] active:scale-95"
              >
                <DiscordIcon className="size-6" /> Join {name}
              </a>
            </div>
          </div>
        </section>
      )}
    </Container>
  );
}
