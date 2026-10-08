import type { Metadata } from "next";
import { requireOwnerPage, listSessions } from "@/lib/auth/session";
import { listUsers } from "@/lib/auth/users";
import { PageTitle } from "@/components/admin/ui";
import { TeamManager } from "@/components/admin/team-manager";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireOwnerPage();
  const members = listUsers().map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    avatarUrl: u.avatarUrl,
    disabled: u.disabled,
    totpEnabled: u.totpEnabled,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt,
    sessions: listSessions(u.id).length,
    isMe: u.id === me.id,
  }));
  return (
    <>
      <PageTitle title="Team" description="Owners can do everything. Admins can upload media (reviewed by an owner before it goes live) and edit their own profile." />
      <TeamManager members={members} />
    </>
  );
}
