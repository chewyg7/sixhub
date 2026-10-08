"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";
import {
  ClipboardCheck,
  FolderTree,
  Gauge,
  Images,
  LogOut,
  Menu,
  ScrollText,
  Settings2,
  Shapes,
  BookOpenText,
  UploadCloud,
  Users,
  UserCircle2,
  X,
  DownloadCloud,
  ExternalLink,
  LayoutTemplate,
  FileText,
  Link2,
  ShieldCheck,
  Server,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { logout } from "@/app/chewy/auth-actions";

export interface ShellUser {
  username: string;
  displayName: string;
  role: "owner" | "admin";
  avatarUrl: string | null;
}

const NAV: { href: string; label: string; icon: typeof Gauge; owner?: boolean; badge?: "pending"; group?: string }[] = [
  { href: "/chewy", label: "Dashboard", icon: Gauge },
  { href: "/chewy/media", label: "Media", icon: Images },
  { href: "/chewy/media/upload", label: "Upload", icon: UploadCloud },
  { href: "/chewy/review", label: "Review queue", icon: ClipboardCheck, owner: true, badge: "pending" },
  { href: "/chewy/folders", label: "Folders", icon: FolderTree, owner: true },
  { href: "/chewy/grabber", label: "GTAVice grabber", icon: DownloadCloud, owner: true },
  { href: "/chewy/taxonomy", label: "Tags & categories", icon: Shapes, owner: true },
  { href: "/chewy/content", label: "Content", icon: BookOpenText, owner: true },
  { href: "/chewy/site", label: "Site editor", icon: LayoutTemplate, owner: true, group: "Site" },
  { href: "/chewy/pages", label: "Pages", icon: FileText, owner: true },
  { href: "/chewy/links", label: "Short links", icon: Link2, owner: true },
  { href: "/chewy/settings", label: "Site settings", icon: Settings2, owner: true },
  { href: "/chewy/users", label: "Team", icon: Users, owner: true, group: "Admin" },
  { href: "/chewy/security", label: "Security", icon: ShieldCheck, owner: true },
  { href: "/chewy/system", label: "System & backups", icon: Server, owner: true },
  { href: "/chewy/audit", label: "Audit log", icon: ScrollText, owner: true },
];

export function Avatar({ user, size = 36 }: { user: Pick<ShellUser, "displayName" | "avatarUrl">; size?: number }) {
  return user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- uploaded avatar
    <img src={user.avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[image:var(--sunset)] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {user.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AdminShell({ user, pending, children }: { user: ShellUser; pending: number; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.owner || user.role === "owner");
  const active = (href: string) =>
    href === "/chewy" ? path === href : path === href || (path.startsWith(href + "/") && !items.some((i) => i.href !== href && i.href.startsWith(href) && path.startsWith(i.href)));

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, badge, group }) => (
        <Fragment key={href}>
          {group && <p className="mt-4 mb-1 px-3.5 text-[11.5px] font-bold tracking-wider text-white/35 uppercase">{group}</p>}
          <Link
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active(href) ? "page" : undefined}
            className={cn(
              "group flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[14.5px] font-bold transition-colors",
              active(href) ? "bg-white text-[#140c18]" : "text-white/65 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="size-[18px]" />
            <span className="flex-1">{label}</span>
            {badge === "pending" && pending > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11.5px] text-white">{pending}</span>}
          </Link>
        </Fragment>
      ))}
    </nav>
  );

  const account = (
    <div className="mt-auto border-t border-white/10 pt-4">
      <Link href="/chewy/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white/8">
        <Avatar user={user} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-white">{user.displayName}</span>
          <span className="block text-[12.5px] text-white/50 capitalize">
            {user.role} · @{user.username}
          </span>
        </span>
        <UserCircle2 className="size-4 text-white/40" />
      </Link>
      <div className="mt-2 flex gap-2">
        <Link
          href="/"
          target="_blank"
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white/6 text-[13px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
        >
          <ExternalLink className="size-4" /> View site
        </Link>
        <form action={logout} className="flex-1">
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/6 text-[13px] font-bold text-white/70 hover:bg-[#ff4d6d]/20 hover:text-[#ff8a9a]"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-svh bg-[#0b0910] text-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-white/8 bg-[#0e0b14] p-4 lg:flex">
        <Link href="/chewy" className="mb-6 flex items-center gap-3 px-2 pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img src="/brand/logo-480.webp" alt="" className="h-9 w-auto" />
          <span className="text-[13px] font-bold tracking-wide text-white/50">Admin</span>
        </Link>
        <div className="no-scrollbar -mx-1 flex-1 overflow-y-auto px-1">{nav}</div>
        {account}
      </aside>

      {/* Mobile bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/8 bg-[#0e0b14]/90 px-4 backdrop-blur-lg lg:hidden">
        <Link href="/chewy" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img src="/brand/logo-480.webp" alt="" className="h-8 w-auto" />
          <span className="text-[13px] font-bold text-white/50">Admin</span>
        </Link>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="flex size-11 items-center justify-center rounded-full bg-white/8">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(320px,88vw)] flex-col bg-[#0e0b14] p-4">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="mb-4 ml-auto flex size-11 items-center justify-center rounded-full bg-white/8">
              <X className="size-5" />
            </button>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {account}
          </div>
        </div>
      )}

      <main className="px-4 py-8 sm:px-8 lg:ml-[272px] lg:px-12 lg:py-12">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
