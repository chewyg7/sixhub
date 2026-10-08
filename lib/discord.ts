import "server-only";

/** Public info about a Discord server, from its invite (no bot or token needed). */
export interface DiscordServer {
  name: string;
  description: string | null;
  tag: string | null;
  icon: string | null;
  banner: string | null;
  members: number | null;
  online: number | null;
  boosts: number;
  boostTier: number;
  traits: { label: string; emoji: string | null }[];
}

/** "gtavc" from "https://discord.gg/gtavc" or "https://discord.com/invite/gtavc". */
export function inviteCode(url: string): string | null {
  const m = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,40})\/?$/.exec(url.trim());
  return m?.[1] ?? null;
}

// Discord sends emoji names; map the common ones it uses for server traits.
const EMOJI: Record<string, string> = {
  video_game: "🎮",
  busts_in_silhouette: "👥",
  clown: "🤡",
  speaking_head: "🗣️",
  oncoming_police_car: "🚔",
  palm_tree: "🌴",
  art: "🎨",
  musical_note: "🎵",
  movie_camera: "🎥",
  camera: "📷",
  newspaper: "📰",
  tada: "🎉",
  fire: "🔥",
  red_car: "🚗",
  money_with_wings: "💸",
};

type Invite = {
  approximate_member_count?: number;
  approximate_presence_count?: number;
  guild?: { id: string; name: string; description: string | null; icon: string | null; banner: string | null; splash: string | null; premium_subscription_count?: number; premium_tier?: number };
  profile?: { tag?: string | null; traits?: { label: string; emoji_name: string | null }[] };
};

/** Fetches the server behind an invite. Cached for 5 minutes; null if Discord can't be reached. */
export async function getDiscordServer(code: string): Promise<DiscordServer | null> {
  try {
    const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Invite;
    const g = d.guild;
    if (!g) return null;
    const cdn = "https://cdn.discordapp.com";
    return {
      name: g.name,
      description: g.description,
      tag: d.profile?.tag ?? null,
      icon: g.icon ? `${cdn}/icons/${g.id}/${g.icon}.webp?size=256${g.icon.startsWith("a_") ? "&animated=true" : ""}` : null,
      banner: g.banner ? `${cdn}/banners/${g.id}/${g.banner}.webp?size=1280` : g.splash ? `${cdn}/splashes/${g.id}/${g.splash}.webp?size=1920` : null,
      members: d.approximate_member_count ?? null,
      online: d.approximate_presence_count ?? null,
      boosts: g.premium_subscription_count ?? 0,
      boostTier: g.premium_tier ?? 0,
      traits: (d.profile?.traits ?? []).map((t) => ({ label: t.label, emoji: t.emoji_name ? (EMOJI[t.emoji_name] ?? null) : null })),
    };
  } catch {
    return null;
  }
}
