"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Copy, Monitor, ShieldCheck } from "lucide-react";
import { disableTotp, enableTotp, regenerateRecovery, removeAvatar, revokeMySession, revokeOtherSessions, saveProfile, type SecurityState } from "@/app/chewy/(panel)/profile/actions";
import type { ActionState } from "@/lib/admin/action";
import type { UserLinks } from "@/lib/auth/users";
import { PasswordForm } from "./auth-forms";
import { Avatar } from "./shell";
import { Badge, Button, Card, ConfirmButton, Field, Input, Notice, SubmitButton, Textarea } from "./ui";
import { formatTime } from "./format";

function RecoveryCodes({ codes }: { codes?: string[] }) {
  const [copied, setCopied] = useState(false);
  if (!codes?.length) return null;
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <p className="text-[14px] font-bold">Your recovery codes</p>
      <p className="mt-1 text-[13px] text-white/60">Each works once if you lose your phone. Store them somewhere safe; they won’t be shown again.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-[15px] sm:grid-cols-5">
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-black/40 px-2 py-1.5 text-center select-all">
            {c}
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        className="mt-3"
        onClick={() => {
          navigator.clipboard.writeText(codes.join("\n"));
          setCopied(true);
        }}
      >
        <Copy /> {copied ? "Copied" : "Copy all"}
      </Button>
    </div>
  );
}

export function ProfileForms({
  user,
  setup,
  sessions,
  recoveryLeft,
}: {
  user: { displayName: string; bio: string; links: UserLinks; avatarUrl: string | null; username: string; totpEnabled: boolean };
  setup: { secret: string; qr: string } | null;
  sessions: { id: string; device: string; ip: string; lastSeenAt: number; createdAt: number; current: boolean }[];
  recoveryLeft: number;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [profileState, profileAction] = useActionState<ActionState, FormData>(saveProfile, {});
  const [enableState, enableAction] = useActionState<SecurityState, FormData>(enableTotp, {});
  const [disableState, disableAction] = useActionState<SecurityState, FormData>(disableTotp, {});
  const [regenState, regenAction] = useActionState<SecurityState, FormData>(regenerateRecovery, {});
  const [msg, setMsg] = useState<ActionState>({});
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [busy, start] = useTransition();

  const uploadAvatar = async (file: File) => {
    setAvatarBusy(true);
    const r = await fetch("/chewy/api/upload", { method: "POST", headers: { "x-chewy": "1", "x-upload-meta": encodeURIComponent(JSON.stringify({ purpose: "avatar" })), "content-type": "application/octet-stream" }, body: file });
    const j = await r.json().catch(() => ({ error: "Upload failed." }));
    setMsg(j.error ? { error: j.error } : { ok: "Photo updated." });
    setAvatarBusy(false);
    router.refresh();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Profile">
        <div className="mb-5 flex items-center gap-4">
          <Avatar user={user} size={72} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={avatarBusy} onClick={() => fileInput.current?.click()}>
              <Camera /> {avatarBusy ? "Uploading…" : "Change photo"}
            </Button>
            {user.avatarUrl && (
              <Button
                size="sm"
                tone="ghost"
                onClick={() =>
                  start(async () => {
                    setMsg(await removeAvatar());
                    router.refresh();
                  })
                }
              >
                Remove
              </Button>
            )}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </div>
        </div>
        <Notice tone="success">{msg.ok}</Notice>
        <Notice tone="error">{msg.error}</Notice>
        <form action={profileAction} className="mt-2 grid gap-4">
          <Notice tone="success">{profileState.ok}</Notice>
          <Notice tone="error">{profileState.error}</Notice>
          <Field label="Display name">
            <Input name="displayName" defaultValue={user.displayName} required maxLength={60} />
          </Field>
          <Field label="Bio">
            <Textarea name="bio" defaultValue={user.bio} maxLength={500} className="min-h-20" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Discord username">
              <Input name="discord" defaultValue={user.links.discord ?? ""} maxLength={60} />
            </Field>
            <Field label="X profile link">
              <Input name="x" type="url" defaultValue={user.links.x ?? ""} placeholder="https://x.com/…" />
            </Field>
            <Field label="Instagram link">
              <Input name="instagram" type="url" defaultValue={user.links.instagram ?? ""} placeholder="https://www.instagram.com/…" />
            </Field>
            <Field label="Website">
              <Input name="website" type="url" defaultValue={user.links.website ?? ""} />
            </Field>
          </div>
          <div>
            <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
          </div>
        </form>
      </Card>

      <div className="grid content-start gap-6">
        <Card title="Password">
          <PasswordForm />
        </Card>

        <section id="security" className="scroll-mt-24">
          <Card
            title="Two-factor authentication"
            description="A code from an authenticator app (Google Authenticator, 1Password, Authy…) in addition to your password."
            actions={user.totpEnabled ? <Badge tone="good">On</Badge> : <Badge tone="warn">Off</Badge>}
          >
            <div className="grid gap-4">
              <RecoveryCodes codes={enableState.recoveryCodes ?? regenState.recoveryCodes} />
              {setup ? (
                <form action={enableAction} className="grid gap-4">
                  <Notice tone="error">{enableState.error}</Notice>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated QR code */}
                    <img src={setup.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-2xl bg-white p-2" />
                    <div className="text-[14px] text-white/70">
                      <p>1. Scan the code with your authenticator app.</p>
                      <p className="mt-1">
                        Can’t scan? Enter this key: <code className="font-mono text-[13px] break-all text-white select-all">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                      </p>
                      <p className="mt-3">2. Type the 6-digit code it shows.</p>
                    </div>
                  </div>
                  <input type="hidden" name="secret" value={setup.secret} />
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Code">
                      <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required className="w-40 text-center text-[20px] tracking-[0.3em]" />
                    </Field>
                    <SubmitButton pendingLabel="Checking…">
                      <ShieldCheck className="size-4" /> Turn on
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <>
                  <p className="text-[14px] text-white/60">{recoveryLeft} recovery code{recoveryLeft === 1 ? "" : "s"} left.</p>
                  <form action={regenAction} className="flex flex-wrap items-end gap-3">
                    <Field label="Password">
                      <Input name="password" type="password" autoComplete="current-password" required className="w-56" />
                    </Field>
                    <SubmitButton tone="secondary" pendingLabel="Working…">
                      New recovery codes
                    </SubmitButton>
                  </form>
                  <Notice tone="error">{regenState.error}</Notice>
                  <details className="rounded-2xl border border-white/10 p-4">
                    <summary className="cursor-pointer text-[14px] font-bold text-white/70">Turn off two-factor authentication</summary>
                    <form action={disableAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <Field label="Password">
                        <Input name="password" type="password" autoComplete="current-password" required />
                      </Field>
                      <Field label="Current code">
                        <Input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} />
                      </Field>
                      <SubmitButton tone="danger" pendingLabel="Turning off…">
                        Turn off
                      </SubmitButton>
                    </form>
                    <div className="mt-3">
                      <Notice tone="error">{disableState.error}</Notice>
                      <Notice tone="success">{disableState.ok}</Notice>
                    </div>
                  </details>
                </>
              )}
            </div>
          </Card>
        </section>

        <Card
          title="Where you're signed in"
          actions={
            sessions.length > 1 && (
              <ConfirmButton
                tone="secondary"
                disabled={busy}
                confirmLabel="Sign them out"
                onConfirm={() =>
                  start(async () => {
                    setMsg(await revokeOtherSessions());
                    router.refresh();
                  })
                }
              >
                Sign out other devices
              </ConfirmButton>
            )
          }
        >
          <ul className="divide-y divide-white/8">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Monitor className="size-5 shrink-0 text-white/40" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[14px] font-bold">
                    {s.device} {s.current && <Badge tone="good">This device</Badge>}
                  </span>
                  <span className="block text-[12.5px] text-white/45">
                    {s.ip} · signed in {formatTime(s.createdAt)} · active {formatTime(s.lastSeenAt)}
                  </span>
                </span>
                {!s.current && (
                  <Button
                    size="sm"
                    tone="ghost"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        setMsg(await revokeMySession(s.id));
                        router.refresh();
                      })
                    }
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
