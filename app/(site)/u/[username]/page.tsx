import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/features/profile/profile-view";
import { getMediaBySlug, getMediaBySlugs } from "@/lib/content";
import { smallestVariant } from "@/lib/media/variants";
import { contributionSlugs, getPublicProfile } from "@/lib/profiles";

// Profiles change whenever a team member edits theirs; always render fresh.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const p = getPublicProfile((await params).username);
  if (!p) return {};
  const { user, profile } = p;
  const description = profile.headline || user.bio || `${user.displayName} on the GTA 6 Hub team.`;
  return {
    title: `${user.displayName} (@${user.username})`,
    description,
    alternates: { canonical: `/@${user.username}` },
    openGraph: { title: `${user.displayName} · GTA 6 Hub`, description, images: user.avatarUrl ? [{ url: user.avatarUrl }] : undefined },
  };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const p = getPublicProfile((await params).username);
  if (!p) notFound();
  const { profile } = p;
  const [uploads, banner, pinned] = await Promise.all([
    profile.showContributions ? getMediaBySlugs(contributionSlugs(p.user.id)) : Promise.resolve([]),
    profile.bannerSlug ? getMediaBySlug(profile.bannerSlug) : Promise.resolve(undefined),
    profile.showContributions ? getMediaBySlugs(profile.pinned) : Promise.resolve([]),
  ]);
  return (
    <ProfileView
      user={p.user}
      profile={profile}
      bannerUrl={banner ? (smallestVariant(banner, 1920)?.url ?? banner.original.url) : null}
      uploads={uploads}
      pinned={pinned.filter((m) => uploads.some((u) => u.slug === m.slug))}
    />
  );
}
