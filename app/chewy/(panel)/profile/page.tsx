import type { Metadata } from "next";
import QRCode from "qrcode";
import { currentSession, listSessions, requireUserPage } from "@/lib/auth/session";
import { getAuthRecordById } from "@/lib/auth/users";
import { newTotpSecret, otpauthUrl } from "@/lib/auth/totp";
import { deviceLabel } from "@/lib/auth/request";
import { PageTitle } from "@/components/admin/ui";
import { ProfileForms } from "@/components/admin/profile-forms";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const user = await requireUserPage();
  const session = await currentSession();
  const rec = getAuthRecordById(user.id);
  // A fresh secret is offered each visit until 2FA is turned on.
  const setup = user.totpEnabled
    ? null
    : await (async () => {
        const secret = newTotpSecret();
        return { secret, qr: await QRCode.toDataURL(otpauthUrl(secret, user.username), { margin: 1, width: 240, color: { dark: "#0b0910", light: "#ffffff" } }) };
      })();
  return (
    <>
      <PageTitle title="Your profile" description={`@${user.username} · ${user.role === "owner" ? "Owner" : "Admin"}`} />
      <ProfileForms
        user={{ displayName: user.displayName, bio: user.bio, links: user.links, avatarUrl: user.avatarUrl, username: user.username, totpEnabled: user.totpEnabled }}
        recoveryLeft={rec?.recoveryHashes.length ?? 0}
        setup={setup}
        sessions={listSessions(user.id).map((s) => ({ id: s.id, device: deviceLabel(s.userAgent), ip: s.ip ?? "unknown", lastSeenAt: s.lastSeenAt, createdAt: s.createdAt, current: s.id === session?.id }))}
      />
    </>
  );
}
