import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { currentSession, listSessions, requireUserPage } from "@/lib/auth/session";
import { getAuthRecordById, getUserById } from "@/lib/auth/users";
import { newTotpSecret, otpauthUrl } from "@/lib/auth/totp";
import { deviceLabel } from "@/lib/auth/request";
import { listMediaRows } from "@/lib/db/content";
import { smallestVariant } from "@/lib/media/variants";
import { contributionSlugs, getProfileSettings } from "@/lib/profiles";
import { Notice, PageTitle } from "@/components/admin/ui";
import { ProfileForms } from "@/components/admin/profile-forms";
import { PublicProfileEditor, type PickerItem } from "@/components/admin/public-profile-editor";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/chewy/profile">) {
  const me = await requireUserPage();
  // Owners can open anyone's profile with ?user=<id>; everyone else always gets their own.
  const requested = (await searchParams).user;
  const otherId = typeof requested === "string" && requested !== me.id && me.role === "owner" ? requested : null;
  const user = otherId ? getUserById(otherId) : me;
  if (!user) return <Notice tone="error">That team member no longer exists.</Notice>;

  const session = await currentSession();
  const rec = getAuthRecordById(user.id);
  // A fresh secret is offered each visit until 2FA is turned on.
  const setup =
    otherId || user.totpEnabled
      ? null
      : await (async () => {
          const secret = newTotpSecret();
          return { secret, qr: await QRCode.toDataURL(otpauthUrl(secret, user.username), { margin: 1, width: 240, color: { dark: "#0b0910", light: "#ffffff" } }) };
        })();

  // Cover choices: wide official art. Pinned choices: this member's own uploads.
  const rows = listMediaRows();
  const thumb = (r: (typeof rows)[number]) => smallestVariant(r.item, 320)?.url ?? null;
  const banners: PickerItem[] = rows
    .filter((r) => r.item.kind === "image" && !r.item.original.hasAlpha && (r.item.width ?? 0) >= 1600 && (r.item.width ?? 0) > (r.item.height ?? 0) && r.item.category === "artwork")
    .map((r) => ({ slug: r.item.slug, title: r.item.title, thumb: thumb(r) }));
  const mine = new Set(contributionSlugs(user.id));
  const uploads: PickerItem[] = rows.filter((r) => mine.has(r.item.slug)).map((r) => ({ slug: r.item.slug, title: r.item.title, thumb: thumb(r) }));

  return (
    <>
      <PageTitle
        title={otherId ? user.displayName : "Your profile"}
        description={
          <>
            @{user.username} · {user.role === "owner" ? "Owner" : "Admin"} ·{" "}
            <Link href={`/@${user.username}`} target="_blank" className="font-bold text-accent-text">
              gtasixhub.com/@{user.username}
            </Link>
          </>
        }
      />
      {otherId && (
        <div className="mb-6">
          <Notice tone="info">You’re editing {user.displayName}’s profile as an owner. Their password and sign-in settings stay theirs.</Notice>
        </div>
      )}
      <ProfileForms
        user={{ displayName: user.displayName, bio: user.bio, links: user.links, avatarUrl: user.avatarUrl, username: user.username, totpEnabled: user.totpEnabled }}
        recoveryLeft={rec?.recoveryHashes.length ?? 0}
        setup={setup}
        sessions={otherId ? [] : listSessions(user.id).map((s) => ({ id: s.id, device: deviceLabel(s.userAgent), ip: s.ip ?? "unknown", lastSeenAt: s.lastSeenAt, createdAt: s.createdAt, current: s.id === session?.id }))}
        targetId={otherId}
      >
        <PublicProfileEditor targetId={otherId} username={user.username} settings={getProfileSettings(user.id)} banners={banners} uploads={uploads} />
      </ProfileForms>
    </>
  );
}
