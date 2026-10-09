import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { listUsers } from "@/lib/auth/users";
import { getProfileSettings, getTeamSettings } from "@/lib/profiles";
import { PageTitle } from "@/components/admin/ui";
import { TeamPageEditor, type TeamRow } from "@/components/admin/team-page-editor";

export const metadata: Metadata = { title: "Team page" };

export default async function TeamPageAdmin() {
  await requireOwnerPage();
  const settings = getTeamSettings();
  const rows: TeamRow[] = listUsers()
    .map((u) => {
      const t = settings.members[u.id];
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        avatarUrl: u.avatarUrl,
        publicProfile: getProfileSettings(u.id).visible,
        disabled: u.disabled,
        teamRole: t?.role ?? "",
        blurb: t?.blurb ?? "",
        hidden: t?.hidden ?? false,
        order: t?.order ?? 1000 + u.createdAt / 1e13,
      };
    })
    .sort((a, b) => (a.role === b.role ? a.order - b.order : a.role === "owner" ? -1 : 1))
    .map(({ order: _order, ...r }) => r);
  return (
    <>
      <PageTitle title="Team page" description="The public page at /team that introduces everyone. Only owners can edit it." />
      <TeamPageEditor settings={settings} rows={rows} />
    </>
  );
}
