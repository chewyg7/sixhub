import { mediaPicture, ogImage } from "@/lib/og";
import { getMediaBySlug } from "@/lib/content";
import { getPublicProfile } from "@/lib/profiles";

export const alt = "A GTA 6 Hub team member";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Profiles change whenever a team member edits theirs.
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const p = getPublicProfile((await params).username);
  if (!p) return ogImage({ title: "Team", image: "/hero/bg-2000.webp" });
  const { user, profile } = p;
  // Their banner if they've picked one, else their avatar.
  const banner = profile.bannerSlug ? mediaPicture(await getMediaBySlug(profile.bannerSlug)) : undefined;
  return ogImage({
    kicker: `@${user.username}`,
    title: user.displayName,
    lede: profile.headline || user.bio || "On the GTA 6 Hub team.",
    image: banner ?? user.avatarUrl ?? "/hero/bg-2000.webp",
  });
}
