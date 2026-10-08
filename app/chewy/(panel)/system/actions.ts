"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { run, type ActionState } from "@/lib/admin/action";
import { createBackup, deleteBackup, findMissingFiles } from "@/lib/admin/system";
import { formatBytes } from "@/lib/format";

export async function refreshSite(): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    await audit(user, "system.refresh");
    return "Every page will be rebuilt with the latest content on its next visit.";
  });
}

export async function backupNow(): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      const b = await createBackup();
      await audit(user, "system.backup", b.name);
      revalidatePath("/chewy/system");
      return `Backup ${b.name} created (${formatBytes(b.bytes)}).`;
    },
    { revalidate: false },
  );
}

export async function removeBackup(name: string): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      await deleteBackup(name);
      await audit(user, "system.backup.delete", name);
      revalidatePath("/chewy/system");
      return `Deleted ${name}.`;
    },
    { revalidate: false },
  );
}

export async function checkFiles(): Promise<ActionState & { missing?: { slug: string; title: string; missing: string[] }[] }> {
  try {
    await requireOwner();
    const missing = await findMissingFiles();
    return { ok: missing.length ? `${missing.length} item${missing.length === 1 ? " is" : "s are"} missing files.` : "Every uploaded file is where it should be.", missing };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Check failed." };
  }
}
