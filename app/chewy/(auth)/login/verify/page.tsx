import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pendingMfa } from "@/lib/auth/session";
import { AuthCard, MfaForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function VerifyPage() {
  const pending = await pendingMfa();
  if (!pending) redirect("/chewy/login");
  return (
    <AuthCard title="One more step" subtitle={`Enter the code from your authenticator app for ${pending.user.username}.`}>
      <MfaForm />
    </AuthCard>
  );
}
