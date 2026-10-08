"use client";

import { useActionState } from "react";
import { Ban, LockOpen, MonitorSmartphone, ShieldAlert } from "lucide-react";
import { blockIpAction, revokeSessionAction, signOutEveryone, unblockIpAction, unlockAction, unlockAll } from "@/app/chewy/(panel)/security/actions";
import type { ActionState } from "@/lib/admin/action";
import { Badge, Button, Card, ConfirmButton, Empty, Input, Notice, SubmitButton, formatTime, useAction } from "./ui";

export interface SecurityData {
  me: { sessionId: string; ip: string };
  sessions: { id: string; username: string; displayName: string; role: string; ip: string | null; device: string; createdAt: number; lastSeenAt: number }[];
  throttle: { key: string; failures: number; lockedUntil: number; lockouts: number; locked: boolean }[];
  blocked: { ip: string; note: string; at: number; by: string }[];
  failed: { id: number; at: number; username: string | null; target: string | null; ip: string | null; action: string }[];
}

const keyLabel = (k: string) => {
  const [kind, ...rest] = k.split(":");
  const v = rest.join(":");
  return kind === "ip" ? `IP ${v}` : kind === "user" ? `Username “${v}”` : kind === "mfa" ? "2FA codes" : k;
};

function BlockForm() {
  const [state, run] = useActionState<ActionState, FormData>(blockIpAction, {});
  return (
    <form action={run} key={state.n} className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Input name="ip" placeholder="IP address, e.g. 203.0.113.7" required maxLength={64} className="max-w-[260px] font-mono text-[13.5px]" />
        <Input name="note" placeholder="Why (optional)" maxLength={120} className="max-w-xs" />
        <SubmitButton tone="danger" pendingLabel="Blocking…">
          Block IP
        </SubmitButton>
      </div>
      <Notice tone="success">{state.ok}</Notice>
      <Notice tone="error">{state.error}</Notice>
    </form>
  );
}

export function SecurityCenter({ data }: { data: SecurityData }) {
  const [pending, result, act] = useAction();
  const locked = data.throttle.filter((t) => t.locked);

  return (
    <div className="grid gap-6">
      <Notice tone="success">{result.ok}</Notice>
      <Notice tone="error">{result.error}</Notice>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Signed-in sessions", value: data.sessions.length },
          { label: "Active lockouts", value: locked.length },
          { label: "Blocked IPs", value: data.blocked.length },
          { label: "Failed sign-ins (recent)", value: data.failed.length },
        ].map((s) => (
          <div key={s.label} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <span className="display-xl block text-[40px] leading-none">{s.value}</span>
            <span className="mt-2 block text-[13.5px] text-white/55">{s.label}</span>
          </div>
        ))}
      </div>

      <Card
        title="Who’s signed in"
        description="Every active admin session. End any you don’t recognise."
        actions={
          <ConfirmButton confirmLabel="Sign everyone else out" onConfirm={() => act(signOutEveryone)} disabled={pending || data.sessions.length < 2}>
            Sign out everyone but me
          </ConfirmButton>
        }
      >
        <ul className="divide-y divide-white/8">
          {data.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <MonitorSmartphone className="size-5 text-white/40" />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-bold">
                  {s.displayName} <span className="font-normal text-white/45">@{s.username}</span> {s.id === data.me.sessionId && <Badge tone="good">This device</Badge>}
                </p>
                <p className="text-[13px] text-white/50">
                  {s.device} · {s.ip ?? "unknown IP"} · signed in {formatTime(s.createdAt)} · active {formatTime(s.lastSeenAt)}
                </p>
              </div>
              <Badge tone={s.role === "owner" ? "accent" : "neutral"}>{s.role}</Badge>
              {s.id !== data.me.sessionId && (
                <Button size="sm" tone="danger" disabled={pending} onClick={() => act(() => revokeSessionAction(s.id))}>
                  End session
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Sign-in locks"
          description="After 5 wrong passwords a username is locked; after 20 an IP is. Each repeat lock lasts twice as long, up to 24 hours."
          actions={
            data.throttle.length > 0 && (
              <ConfirmButton tone="secondary" confirmLabel="Clear all" onConfirm={() => act(unlockAll)} disabled={pending}>
                Clear all
              </ConfirmButton>
            )
          }
        >
          {data.throttle.length ? (
            <ul className="divide-y divide-white/8">
              {data.throttle.map((t) => {
                const isLocked = t.locked;
                return (
                  <li key={t.key} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{keyLabel(t.key)}</span>
                    {isLocked ? <Badge tone="bad">Locked until {formatTime(t.lockedUntil)}</Badge> : <Badge tone="warn">{t.failures} failed</Badge>}
                    {t.lockouts > 0 && <span className="text-[12px] text-white/40">{t.lockouts}× locked</span>}
                    <Button size="sm" disabled={pending} onClick={() => act(() => unlockAction(t.key))}>
                      <LockOpen className="size-3.5" /> Unlock
                    </Button>
                    {t.key.startsWith("ip:") && t.key.slice(3) !== data.me.ip && (
                      <Button
                        size="sm"
                        tone="danger"
                        disabled={pending}
                        onClick={() =>
                          act(() => {
                            const f = new FormData();
                            f.set("ip", t.key.slice(3));
                            f.set("note", "Blocked from sign-in locks");
                            return blockIpAction({}, f);
                          })
                        }
                      >
                        <Ban className="size-3.5" /> Block
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="Nothing locked">No failed sign-ins in the last day.</Empty>
          )}
        </Card>

        <Card title="Blocked IPs" description={`Blocked addresses can’t sign in at all. Your IP right now: ${data.me.ip}`}>
          <BlockForm />
          {data.blocked.length > 0 && (
            <ul className="mt-4 divide-y divide-white/8">
              {data.blocked.map((b) => (
                <li key={b.ip} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="font-mono text-[13.5px] font-bold">{b.ip}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/45">
                    {b.note || "No note"} · @{b.by} · {formatTime(b.at)}
                  </span>
                  <Button size="sm" disabled={pending} onClick={() => act(() => unblockIpAction(b.ip))}>
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[12.5px] text-white/40">
            Locked yourself out? On the server run <code className="text-white/70">npm run admin -- unblock-ips</code>.
          </p>
        </Card>
      </div>

      <Card title="Recent failed and blocked sign-ins">
        {data.failed.length ? (
          <ul className="divide-y divide-white/8">
            {data.failed.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13.5px]">
                <ShieldAlert className="size-4 text-[#ff8a9a]" />
                <span className="font-bold">{a.target ?? a.username ?? "unknown"}</span>
                <span className="text-white/50">{a.action.replace("login.", "").replace("_", " ")}</span>
                <span className="font-mono text-white/45">{a.ip}</span>
                <span className="ml-auto text-[12.5px] text-white/40">{formatTime(a.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No failed sign-ins" />
        )}
      </Card>
    </div>
  );
}
