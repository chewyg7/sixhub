import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, pendingMfa } from "@/lib/auth/session";
import { AuthCard, LoginForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/chewy");
  if (await pendingMfa()) redirect("/chewy/login/verify");
  return (
    <AuthCard title="Staff sign in" subtitle="For the GTA 6 Hub team only.">
      <LoginForm />
    </AuthCard>
  );
}
