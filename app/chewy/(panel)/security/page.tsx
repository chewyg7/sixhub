import type { Metadata } from "next";
import { currentSession, requireOwnerPage } from "@/lib/auth/session";
import { clientIp, deviceLabel } from "@/lib/auth/request";
import { listAudit } from "@/lib/auth/audit";
import { blockedIps, listAllSessions, listThrottle } from "@/lib/auth/security";
import { PageTitle } from "@/components/admin/ui";
import { SecurityCenter, type SecurityData } from "@/components/admin/security-center";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  await requireOwnerPage();
  const [session, ip] = await Promise.all([currentSession(), clientIp()]);
  const failed = [...listAudit({ action: "login.failed", limit: 25 }), ...listAudit({ action: "login.blocked", limit: 25 })]
    .sort((a, b) => b.at - a.at)
    .slice(0, 30);
  const data: SecurityData = {
    me: { sessionId: session?.id ?? "", ip },
    sessions: listAllSessions().map((s) => ({ id: s.id, username: s.username, displayName: s.displayName, role: s.role, ip: s.ip, device: deviceLabel(s.userAgent), createdAt: s.createdAt, lastSeenAt: s.lastSeenAt })),
    throttle: listThrottle(),
    blocked: blockedIps(),
    failed: failed.map((a) => ({ id: a.id, at: a.at, username: a.username, target: a.target, ip: a.ip, action: a.action })),
  };
  return (
    <>
      <PageTitle title="Security" description="Sessions, sign-in locks and blocked addresses for the admin panel." />
      <SecurityCenter data={data} />
    </>
  );
}
