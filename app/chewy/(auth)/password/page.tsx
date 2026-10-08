import type { Metadata } from "next";
import { requireUserPage } from "@/lib/auth/session";
import { AuthCard, PasswordForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Set your password" };

/** Shown after signing in with a temporary password an owner created. */
export default async function ForcedPasswordPage() {
  const user = await requireUserPage({ allowPasswordChange: true });
  return (
    <AuthCard title="Set your password" subtitle={user.mustChangePassword ? "You signed in with a temporary password. Choose your own to continue." : "Choose a new password."}>
      <PasswordForm forced={user.mustChangePassword} />
    </AuthCard>
  );
}
