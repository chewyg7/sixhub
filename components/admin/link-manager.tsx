"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import { removeLink, saveLink } from "@/app/chewy/(panel)/links/actions";
import type { ActionState } from "@/lib/admin/action";
import type { ShortLink } from "@/lib/db/extras";
import { Badge, Button, Card, ConfirmButton, Empty, Input, Notice, SubmitButton, formatTime, useAction } from "./ui";

function LinkForm({ link, onDone }: { link?: ShortLink; onDone?: () => void }) {
  const [state, run] = useActionState<ActionState, FormData>(async (s, f) => {
    const r = await saveLink(link?.slug ?? null, s, f);
    if (r.ok) onDone?.();
    return r;
  }, {});
  return (
    <form action={run} key={state.n} className="grid gap-2">
      <div className="grid gap-2 md:grid-cols-[200px_1fr_220px_auto]">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] text-white/45">/go/</span>
          <Input name="slug" defaultValue={link?.slug} placeholder="discord" maxLength={80} required className="font-mono text-[13.5px]" />
        </div>
        <Input name="url" defaultValue={link?.url} placeholder="https://discord.gg/… or /media/…" maxLength={500} required className="font-mono text-[13.5px]" />
        <Input name="note" defaultValue={link?.note} placeholder="Note (optional)" maxLength={120} />
        <SubmitButton pendingLabel="Saving…">{link ? "Save" : "Create link"}</SubmitButton>
      </div>
      <Notice tone="success">{link ? undefined : state.ok}</Notice>
      <Notice tone="error">{state.error}</Notice>
    </form>
  );
}

export function LinkManager({ links, origin }: { links: ShortLink[]; origin: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, result, act] = useAction();
  return (
    <div className="grid gap-6">
      <Card
        title="New short link"
        description="Handy for socials and videos: gtasixhub.com/go/trailer3 sends people wherever you point it, and counts the clicks. Change the destination any time."
      >
        <LinkForm />
      </Card>
      <Notice tone="success">{result.ok}</Notice>
      <Notice tone="error">{result.error}</Notice>
      {links.length ? (
        <Card title={`${links.length} link${links.length === 1 ? "" : "s"}`}>
          <ul className="divide-y divide-white/8">
            {links.map((l) => (
              <li key={l.slug} className="py-3">
                {editing === l.slug ? (
                  <LinkForm link={l} onDone={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-mono text-[14px] font-bold">
                        /go/{l.slug}
                        <button
                          type="button"
                          aria-label="Copy link"
                          onClick={() => navigator.clipboard.writeText(`${origin}/go/${l.slug}`).then(() => setCopied(l.slug))}
                          className="text-white/40 hover:text-white"
                        >
                          {copied === l.slug ? <Check className="size-4 text-[#7ee8ae]" /> : <Copy className="size-4" />}
                        </button>
                      </p>
                      <p className="truncate text-[13px] text-white/50">
                        → {l.url}
                        {l.note && <span className="text-white/35"> · {l.note}</span>}
                      </p>
                    </div>
                    <Badge tone={l.clicks ? "accent" : "neutral"}>{l.clicks.toLocaleString("en-US")} clicks</Badge>
                    <span className="hidden text-[12.5px] text-white/40 md:block">{l.lastClickAt ? `Last ${formatTime(l.lastClickAt)}` : "Never clicked"}</span>
                    <Button size="sm" onClick={() => setEditing(l.slug)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <ConfirmButton confirmLabel="Delete" onConfirm={() => act(() => removeLink(l.slug))} disabled={pending}>
                      Delete
                    </ConfirmButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty title="No short links yet" />
      )}
    </div>
  );
}
