import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { listAudit } from "@/lib/auth/audit";
import { listCategories, listFolders, listMediaRows } from "@/lib/db/content";
import { getSettings } from "@/lib/db/content";
import { smallestVariant } from "@/lib/media/variants";
import { Badge, Card, Notice, PageTitle } from "@/components/admin/ui";
import { formatTime } from "@/components/admin/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: PageProps<"/chewy">) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const rows = listMediaRows({ all: true });
  const published = rows.filter((r) => r.status === "published" && !r.hidden);
  const pending = rows.filter((r) => r.status === "pending");
  const hidden = rows.filter((r) => r.hidden);
  const mine = rows.filter((r) => r.createdBy === user.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = [...rows].sort((a, b) => b.item.dateAdded.localeCompare(a.item.dateAdded)).slice(0, 8);
  const categories = listCategories();
  const settings = getSettings();
  const activity = user.role === "owner" ? listAudit({ limit: 8 }) : [];

  const stats = [
    { label: "Published", value: published.length },
    { label: "Awaiting review", value: pending.length, href: user.role === "owner" ? "/chewy/review" : undefined },
    { label: "Hidden", value: hidden.length },
    { label: "Folders", value: listFolders().length },
  ];

  return (
    <>
      <PageTitle kicker={`Signed in as @${user.username}`} title={`Hey, ${user.displayName}`} description="Here's what's happening across the archive." />
      <div className="grid gap-4">
        {sp.denied && <Notice tone="error">That area is for owners only.</Notice>}
        {sp.password === "changed" && <Notice tone="success">Password changed. Other devices were signed out.</Notice>}
        {!user.totpEnabled && (
          <Notice tone={user.role === "owner" ? "error" : "info"}>
            <span className="flex items-center gap-2">
              <ShieldAlert className="size-4 shrink-0" />
              Two-factor authentication is off for your account.{" "}
              <Link href="/chewy/profile#security" className="font-bold underline underline-offset-4">
                Turn it on
              </Link>
            </span>
          </Notice>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <span className="display-xl block text-[48px] leading-none">{s.value.toLocaleString("en-US")}</span>
              <span className="mt-2 block text-[14px] text-white/55">{s.label}</span>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 transition-colors hover:bg-white/[0.06]">
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Recently added" actions={<Link href="/chewy/media" className="text-[13.5px] font-bold text-accent-text">All media</Link>}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recent.map(({ item, status, hidden: h }) => (
              <li key={item.slug}>
                <Link href={`/chewy/media/${item.slug}`} className="group block">
                  <span className="relative block aspect-video overflow-hidden rounded-xl bg-white/5" style={{ backgroundColor: item.dominantColor ?? undefined }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                    <img src={smallestVariant(item, 320)?.url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {(status === "pending" || h) && (
                      <span className="absolute top-1.5 left-1.5">
                        <Badge tone="warn">{status === "pending" ? "Pending" : "Hidden"}</Badge>
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-[13px] text-white/75">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Site status">
          <dl className="grid gap-3 text-[14px]">
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Release date</dt>
              <dd className="font-bold">{settings.release.date}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Launch mode</dt>
              <dd>
                <Badge tone={settings.launchMode === "auto" ? "neutral" : "accent"}>{{ auto: "Automatic", launched: "Forced: out now", countdown: "Forced: countdown" }[settings.launchMode]}</Badge>
              </dd>
            </div>
            {categories.map((c) => (
              <div key={c.slug} className="flex justify-between gap-4">
                <dt className="text-white/55">{c.label}</dt>
                <dd className="tabular-nums">{published.filter((r) => r.item.category === c.slug).length}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {user.role === "admin" && (
        <Card title="Your uploads" className="mt-6" description="Owners review new uploads before they go live.">
          {mine.length ? (
            <ul className="divide-y divide-white/8">
              {mine.slice(0, 10).map((r) => (
                <li key={r.item.slug} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/chewy/media/${r.item.slug}`} className="truncate text-[14px] hover:text-accent-text">
                    {r.item.title}
                  </Link>
                  <Badge tone={r.status === "pending" ? "warn" : "good"}>{r.status === "pending" ? "Awaiting review" : "Live"}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-white/55">
              Nothing yet.{" "}
              <Link href="/chewy/media/upload" className="font-bold text-accent-text">
                Upload something
              </Link>
            </p>
          )}
        </Card>
      )}

      {activity.length > 0 && (
        <Card title="Latest activity" className="mt-6" actions={<Link href="/chewy/audit" className="text-[13.5px] font-bold text-accent-text">Audit log</Link>}>
          <ul className="divide-y divide-white/8">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[14px]">
                <span className="flex items-center gap-2">
                  {a.action.startsWith("login.failed") || a.action.includes("blocked") ? <ShieldAlert className="size-4 text-[#ff8a9a]" /> : <ShieldCheck className="size-4 text-white/35" />}
                  <span className="font-bold">{a.username ?? "Unknown"}</span>
                  <span className="text-white/60">{a.action}</span>
                  {a.target && <span className="truncate text-white/40">{a.target}</span>}
                </span>
                <span className="text-[12.5px] text-white/40">{formatTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-10 flex items-center gap-1.5 text-[13px] text-white/35">
        Changes go live immediately; no rebuild needed. <ArrowUpRight className="size-3.5" />
      </p>
    </>
  );
}
