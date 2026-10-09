import "server-only";
import { db, fromJson, now, toJson } from "@/lib/db";
import { listUsers, type User } from "@/lib/auth/users";
import { listMediaRows } from "@/lib/db/content";

/* ------------------------------------------------------------------ */
/* Public profiles (/@username)                                        */
/* ------------------------------------------------------------------ */

export type ProfileTheme = "aurora" | "sunset" | "midnight" | "mono";
export type ButtonStyle = "glass" | "solid" | "outline";

export interface ProfileLink {
  id: string;
  label: string;
  url: string;
  /** Shown first, bigger, in the accent colour. */
  featured?: boolean;
}

/** What each team member can customise on their public page. */
export interface ProfileSettings {
  /** The page exists at all (off = 404). */
  visible: boolean;
  headline: string;
  pronouns: string;
  location: string;
  /** Accent hue, 0–360. */
  accentHue: number;
  theme: ProfileTheme;
  /** Archive media slug used as the cover image ("" = gradient only). */
  bannerSlug: string;
  buttonStyle: ButtonStyle;
  links: ProfileLink[];
  /** The Contributions tab (their uploads). */
  showContributions: boolean;
  /** Pinned uploads, shown first on the Contributions tab. */
  pinned: string[];
}

export const DEFAULT_PROFILE: ProfileSettings = {
  visible: true,
  headline: "",
  pronouns: "",
  location: "",
  accentHue: 325,
  theme: "aurora",
  bannerSlug: "",
  buttonStyle: "glass",
  links: [],
  showContributions: true,
  pinned: [],
};

export function getProfileSettings(userId: string): ProfileSettings {
  const r = db().prepare("SELECT profile FROM users WHERE id = ?").get(userId) as { profile: string } | undefined;
  return { ...DEFAULT_PROFILE, ...fromJson<Partial<ProfileSettings>>(r?.profile ?? "{}", {}) };
}

export function saveProfileSettings(userId: string, p: ProfileSettings) {
  db().prepare("UPDATE users SET profile = ?, updated_at = ? WHERE id = ?").run(toJson(p), now(), userId);
}

export interface PublicProfile {
  user: Pick<User, "id" | "username" | "displayName" | "role" | "avatarUrl" | "bio" | "links" | "createdAt">;
  profile: ProfileSettings;
}

/** A team member's public page, or null if they don't exist, are disabled or have hidden it. */
export function getPublicProfile(username: string): PublicProfile | null {
  const u = listUsers().find((x) => x.username.toLowerCase() === username.toLowerCase());
  if (!u || u.disabled) return null;
  const profile = getProfileSettings(u.id);
  if (!profile.visible) return null;
  return { user: { id: u.id, username: u.username, displayName: u.displayName, role: u.role, avatarUrl: u.avatarUrl, bio: u.bio, links: u.links, createdAt: u.createdAt }, profile };
}

/** Published, visible media a user uploaded or imported, newest first. */
export function contributionSlugs(userId: string): string[] {
  return listMediaRows()
    .filter((r) => r.createdBy === userId)
    .sort((a, b) => b.item.dateAdded.localeCompare(a.item.dateAdded))
    .map((r) => r.item.slug);
}

/* ------------------------------------------------------------------ */
/* The team page (/team), edited by owners                             */
/* ------------------------------------------------------------------ */

export interface TeamMemberSettings {
  /** Title on the team page, e.g. "Founder" or "Media archivist". */
  role: string;
  /** A sentence or two about them. */
  blurb: string;
  hidden: boolean;
  order: number;
}

export interface TeamPageSettings {
  kicker: string;
  title: string;
  intro: string;
  ownersHeading: string;
  teamHeading: string;
  closingTitle: string;
  closing: string;
  signoff: string;
  showJoin: boolean;
  members: Record<string, TeamMemberSettings>;
}

export const DEFAULT_TEAM: TeamPageSettings = {
  kicker: "The team",
  title: "The people behind GTA 6 Hub",
  intro: "We’re a small group of fans who couldn’t wait for Leonida. Everything here, every screenshot catalogued, every frame captured, every late-night countdown check, is made by us, for you.",
  ownersHeading: "Founders",
  teamHeading: "The crew",
  closingTitle: "Thank you",
  closing: "To everyone who visits, shares a find, or hangs out in the Discord: this place only exists because of you. We’ll see you in Vice City.",
  signoff: "— The GTA 6 Hub team",
  showJoin: true,
  members: {},
};

const TEAM_KEY = "team_page";

export function getTeamSettings(): TeamPageSettings {
  const r = db().prepare("SELECT value FROM settings WHERE key = ?").get(TEAM_KEY) as { value: string } | undefined;
  const stored = fromJson<Partial<TeamPageSettings>>(r?.value ?? "{}", {});
  return { ...DEFAULT_TEAM, ...stored, members: { ...stored.members } };
}

export function saveTeamSettings(t: TeamPageSettings) {
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(TEAM_KEY, toJson(t));
}

export interface TeamMember extends PublicProfile {
  team: TeamMemberSettings;
  uploads: number;
}

/** Everyone shown on /team: active members whose profile is public and who aren't hidden, owners first. */
export function getTeamMembers(): { owners: TeamMember[]; team: TeamMember[]; settings: TeamPageSettings } {
  const settings = getTeamSettings();
  const counts = new Map<string, number>();
  for (const r of listMediaRows()) if (r.createdBy) counts.set(r.createdBy, (counts.get(r.createdBy) ?? 0) + 1);
  const members = listUsers()
    .filter((u) => !u.disabled)
    .map((u) => {
      const profile = getProfileSettings(u.id);
      const team: TeamMemberSettings = Object.assign({ role: "", blurb: "", hidden: false, order: 1000 }, settings.members[u.id]);
      return {
        user: { id: u.id, username: u.username, displayName: u.displayName, role: u.role, avatarUrl: u.avatarUrl, bio: u.bio, links: u.links, createdAt: u.createdAt },
        profile,
        team,
        uploads: counts.get(u.id) ?? 0,
      };
    })
    .filter((m) => m.profile.visible && !m.team.hidden)
    .sort((a, b) => a.team.order - b.team.order || a.user.createdAt - b.user.createdAt);
  return { owners: members.filter((m) => m.user.role === "owner"), team: members.filter((m) => m.user.role !== "owner"), settings };
}
