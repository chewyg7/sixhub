"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { listUsers } from "@/lib/auth/users";
import { bool, jsonField, run, str, type ActionState } from "@/lib/admin/action";
import { saveTeamSettings, type TeamPageSettings } from "@/lib/profiles";

const text = (max: number) => z.string().trim().max(max);
const MEMBER = z.object({ id: z.string().max(80), role: text(60), blurb: text(400), hidden: z.boolean() });

/** The /team page: its words, and each member's title, blurb, order and visibility. */
export async function saveTeamPage(_: ActionState, f: FormData): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      const ids = new Set(listUsers().map((u) => u.id));
      const members = jsonField(f, "members", z.array(MEMBER).max(200)).filter((m) => ids.has(m.id));
      const settings: TeamPageSettings = {
        kicker: text(40).parse(str(f, "kicker")),
        title: text(90).min(1, "Add a title").parse(str(f, "title")),
        intro: text(800).parse(str(f, "intro")),
        ownersHeading: text(40).parse(str(f, "ownersHeading")),
        teamHeading: text(40).parse(str(f, "teamHeading")),
        closingTitle: text(60).parse(str(f, "closingTitle")),
        closing: text(1000).parse(str(f, "closing")),
        signoff: text(80).parse(str(f, "signoff")),
        showJoin: bool(f, "showJoin"),
        // The list's order is the page's order.
        members: Object.fromEntries(members.map((m, i) => [m.id, { role: m.role, blurb: m.blurb, hidden: m.hidden, order: i }])),
      };
      saveTeamSettings(settings);
      await audit(user, "team.page.edit");
      revalidatePath("/team");
      return "Team page saved.";
    },
    { revalidate: false },
  );
}
