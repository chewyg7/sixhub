import { requireUserPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin/shell";

/** Every panel page requires a full session (password + 2FA when enabled). */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();
  const pending = user.role === "owner" ? (db().prepare("SELECT COUNT(*) n FROM media WHERE status = 'pending'").get() as { n: number }).n : 0;
  return (
    <AdminShell user={{ username: user.username, displayName: user.displayName, role: user.role, avatarUrl: user.avatarUrl }} pending={pending}>
      {children}
    </AdminShell>
  );
}
