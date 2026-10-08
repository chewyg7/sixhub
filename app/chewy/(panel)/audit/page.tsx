import type { Metadata } from "next";
import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth/session";
import { listAudit } from "@/lib/auth/audit";
import { PageTitle, Empty } from "@/components/admin/ui";
import { formatTime } from "@/components/admin/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Audit log" };

const FILTERS = [
  { v: "", label: "Everything" },
  { v: "login", label: "Sign-ins" },
  { v: "media", label: "Media" },
  { v: "folder", label: "Folders" },
  { v: "user", label: "Team" },
  { v: "settings", label: "Settings" },
  { v: "grabber", label: "Grabber" },
  { v: "2fa", label: "2FA" },
];

export default async function AuditPage({ searchParams }: PageProps<"/chewy/audit">) {
  await requireOwnerPage();
  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action.slice(0, 40) : "";
  const before = typeof sp.before === "string" ? Number(sp.before) || undefined : undefined;
  const rows = listAudit({ limit: 100, action: action || undefined, before });
  const q = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(action ? { action } : {}), ...extra })}`;
  return (
    <>
      <PageTitle title="Audit log" description="Every sign-in and every change made in the admin panel. Entries can't be edited or deleted from here." />
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link
            key={f.v}
            href={f.v ? `?action=${f.v}` : "?"}
            className={cn("h-9 rounded-full px-4 text-[13px] leading-9 font-bold", action === f.v ? "bg-white text-[#140c18]" : "bg-white/8 text-white/65 hover:text-white")}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Empty title="No entries." />
      ) : (
        <div className="overflow-x-auto rounded-[24px] border border-white/10">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="bg-white/[0.04] text-white/55">
              <tr>
                <th className="px-4 py-3 font-bold">When</th>
                <th className="px-4 py-3 font-bold">Who</th>
                <th className="px-4 py-3 font-bold">What</th>
                <th className="px-4 py-3 font-bold">Target</th>
                <th className="px-4 py-3 font-bold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {rows.map((r) => {
                const bad = r.action.includes("failed") || r.action.includes("blocked");
                return (
                  <tr key={r.id} className={bad ? "bg-[#ff4d6d]/[0.06]" : undefined}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-white/55">{formatTime(r.at)}</td>
                    <td className="px-4 py-2.5 font-bold">{r.username ?? "—"}</td>
                    <td className={cn("px-4 py-2.5", bad && "text-[#ff8a9a]")}>{r.action}</td>
                    <td className="max-w-[320px] truncate px-4 py-2.5 text-white/70" title={r.detail ? JSON.stringify(r.detail) : undefined}>
                      {r.target ?? (r.detail ? JSON.stringify(r.detail).slice(0, 80) : "")}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-white/50">{r.ip}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 100 && (
        <div className="mt-6 text-center">
          <Link href={q({ before: String(rows.at(-1)!.id) })} className="inline-flex h-11 items-center rounded-full bg-white/10 px-5 text-[14px] font-bold hover:bg-white/15">
            Older entries
          </Link>
        </div>
      )}
    </>
  );
}
