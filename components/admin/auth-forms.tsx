"use client";

import { useActionState, type ReactNode } from "react";
import { changePassword, login, verifyMfa, type FormState } from "@/app/chewy/auth-actions";
import { Field, Input, Notice, SubmitButton } from "./ui";

/** Centered card used by the sign-in screens. */
export function AuthCard({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#0b0910] px-4 py-10 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_79_163/0.22),transparent)]" />
      <div className="relative w-full max-w-[420px] rounded-[32px] border border-white/10 bg-white/[0.04] p-7 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)] backdrop-blur-xl sm:p-9">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
        <img src="/brand/logo-480.webp" alt="GTA 6 Hub" className="mb-7 h-12 w-auto" />
        <h1 className="display-xl text-[40px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="grid gap-4" autoComplete="on">
      <Notice tone="error">{state.error}</Notice>
      <Field label="Username">
        <Input name="username" autoComplete="username" required maxLength={64} autoFocus spellCheck={false} autoCapitalize="none" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required maxLength={256} />
      </Field>
      <SubmitButton className="mt-2 w-full" pendingLabel="Checking…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function MfaForm() {
  const [state, action] = useActionState<FormState, FormData>(verifyMfa, {});
  return (
    <form action={action} className="grid gap-4">
      <Notice tone="error">{state.error}</Notice>
      <Field label="Authentication code" hint="The 6-digit code from your authenticator app, or one of your recovery codes.">
        <Input name="code" inputMode="text" autoComplete="one-time-code" required maxLength={32} autoFocus spellCheck={false} className="text-center text-[22px] tracking-[0.3em]" />
      </Field>
      <SubmitButton className="mt-2 w-full" pendingLabel="Verifying…">
        Verify
      </SubmitButton>
    </form>
  );
}

export function PasswordForm({ forced }: { forced?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} className="grid gap-4">
      <Notice tone="error">{state.error}</Notice>
      <Field label={forced ? "Temporary password" : "Current password"}>
        <Input name="current" type="password" autoComplete="current-password" required maxLength={256} />
      </Field>
      <Field label="New password" hint="At least 12 characters, mixing three of: lowercase, uppercase, numbers, symbols.">
        <Input name="next" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />
      </Field>
      <Field label="Repeat new password">
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />
      </Field>
      <SubmitButton className="mt-2 w-full" pendingLabel="Saving…">
        {forced ? "Set password and continue" : "Change password"}
      </SubmitButton>
    </form>
  );
}
