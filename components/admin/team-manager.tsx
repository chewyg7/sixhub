"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { createMember, deleteMember, resetMemberPassword, setMemberDisabled, setMemberRole, signOutMember, type TeamState } from "@/app/chewy/(panel)/users/actions";
import { Badge, Button, Card, ConfirmButton, Field, Input, Notice, Select, SubmitButton } from "./ui";
import { Avatar } from "./shell";
import { formatTime } from "./format";

interface Member {
  id: string;
  username: string;
  displayName: string;
  role: "owner" | "admin";
  avatarUrl: string | null;
  disabled: boolean;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: number | null;
  sessions: number;
  isMe: boolean;
}

/** Shows a one-time temporary password with a copy button. */
function TempPassword({ state }: { state: TeamState }) {
  const [copied, setCopied] = useState(false);
  if (!state.tempPassword) return null;
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <p className="text-[14px] font-bold">Temporary password for @{state.forUser}</p>
      <p className="mt-1 text-[13px] text-white/60">Send it to them privately. It’s shown only once, and they’ll have to choose their own password when they sign in.</p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded-xl bg-black/40 px-3 py-2.5 font-mono text-[15px] break-all select-all">{state.tempPassword}</code>
        <Button
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(state.tempPassword ?? "");
            setCopied(true);
          }}
        >
          <Copy /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function TeamManager({ members }: { members: Member[] }) {
  const router = useRouter();
  const [createState, createAction] = useActionState<TeamState, FormData>(createMember, {});
  const [msg, setMsg] = useState<TeamState>({});
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<TeamState>) =>
    start(async () => {
      setMsg(await fn());
      router.refresh();
    });

  return (
    <div className="grid gap-6">
      <Card title="Add someone" description="They get a temporary password and must set their own on first sign-in.">
        <form action={createAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
          <Field label="Username">
            <Input name="username" required pattern="[A-Za-z0-9_.\-]{3,24}" maxLength={24} autoComplete="off" />
          </Field>
          <Field label="Display name">
            <Input name="displayName" maxLength={60} />
          </Field>
          <Field label="Role">
            <Select name="role" defaultValue="admin">
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </Select>
          </Field>
          <SubmitButton pendingLabel="Creating…">
            <UserPlus className="size-4" /> Add
          </SubmitButton>
        </form>
        <div className="mt-4 grid gap-3">
          <Notice tone="error">{createState.error}</Notice>
          <TempPassword state={createState} />
        </div>
      </Card>

      <Notice tone="success">{msg.ok}</Notice>
      <Notice tone="error">{msg.error}</Notice>
      <TempPassword state={msg} />

      <ul className="grid gap-3">
        {members.map((m) => (
          <li key={m.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar user={m} size={48} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[16px] font-bold">
                  {m.displayName}
                  <span className="text-[14px] font-normal text-white/50">@{m.username}</span>
                  {m.isMe && <Badge>You</Badge>}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-white/55">
                  <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role === "owner" ? "Owner" : "Admin"}</Badge>
                  {m.disabled && <Badge tone="bad">Disabled</Badge>}
                  {m.mustChangePassword && <Badge tone="warn">Temporary password</Badge>}
                  <span className="inline-flex items-center gap-1">
                    {m.totpEnabled ? <ShieldCheck className="size-3.5 text-[#7ee8ae]" /> : <ShieldOff className="size-3.5 text-[#ffcc80]" />}
                    2FA {m.totpEnabled ? "on" : "off"}
                  </span>
                  <span>· last sign-in {formatTime(m.lastLoginAt)}</span>
                  <span>
                    · {m.sessions} active session{m.sessions === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
            </div>
            {!m.isMe && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-4">
                <Button size="sm" disabled={busy} onClick={() => act(() => setMemberRole(m.id, m.role === "owner" ? "admin" : "owner"))}>
                  Make {m.role === "owner" ? "admin" : "owner"}
                </Button>
                <ConfirmButton tone="secondary" disabled={busy} confirmLabel="Reset password" onConfirm={() => act(() => resetMemberPassword(m.id))}>
                  <KeyRound className="size-4" /> Reset password
                </ConfirmButton>
                <Button size="sm" disabled={busy || m.sessions === 0} onClick={() => act(() => signOutMember(m.id))}>
                  Sign out everywhere
                </Button>
                <Button size="sm" disabled={busy} onClick={() => act(() => setMemberDisabled(m.id, !m.disabled))}>
                  {m.disabled ? "Enable" : "Disable"}
                </Button>
                <ConfirmButton disabled={busy} confirmLabel={`Delete @${m.username}`} onConfirm={() => act(() => deleteMember(m.id))}>
                  Delete
                </ConfirmButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
