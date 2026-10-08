"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ExternalLink } from "lucide-react";
import { createPage, removePage, updatePage } from "@/app/chewy/(panel)/pages/actions";
import type { ActionState } from "@/lib/admin/action";
import { Markdown } from "@/components/content/markdown";
import { cn } from "@/lib/cn";
import { Card, ConfirmButton, Field, Input, Notice, SubmitButton, Textarea, Toggle } from "./ui";

export function NewPageForm() {
  const [state, run] = useActionState<ActionState, FormData>(createPage, {});
  return (
    <form action={run} className="flex flex-wrap items-start gap-2">
      <Input name="title" placeholder="New page title, e.g. Giveaway rules" maxLength={90} required className="max-w-sm" />
      <SubmitButton pendingLabel="Creating…">Create page</SubmitButton>
      <div className="basis-full">
        <Notice tone="error">{state.error}</Notice>
      </div>
    </form>
  );
}

const CHEATSHEET = [
  ["# Heading", "Big heading"],
  ["## Smaller heading", "Sub-heading"],
  ["**bold**  *italic*", "Emphasis"],
  ["[text](/media)", "Link"],
  ["![caption](https://…)", "Image"],
  ["- item", "List"],
  ["> quote", "Quote"],
  ["---", "Divider"],
];

export function PageEditor({ page }: { page: { slug: string; title: string; description: string; body: string; published: boolean } }) {
  const [state, run] = useActionState<ActionState, FormData>(updatePage.bind(null, page.slug), {});
  const [body, setBody] = useState(page.body);
  const [tab, setTab] = useState<"write" | "preview">("write");
  return (
    <form action={run} className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-4">
        <Notice tone="success">{state.ok}</Notice>
        <Notice tone="error">{state.error}</Notice>
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div role="tablist" className="flex rounded-full bg-black/25 p-1 xl:hidden">
              {(["write", "preview"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn("h-9 rounded-full px-4 text-[13.5px] font-bold capitalize", tab === t ? "bg-white text-[#140c18]" : "text-white/60")}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="hidden text-[13px] text-white/45 xl:block">Markdown on the left, how it looks on the right.</span>
            <span className="tabular text-[12.5px] text-white/40">{body.length.toLocaleString("en-US")} characters</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck
              aria-label="Page content (Markdown)"
              className={cn("min-h-[560px] font-mono text-[13.5px]", tab === "preview" && "hidden xl:block")}
            />
            <div className={cn("max-h-[640px] overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-5", tab === "write" && "hidden xl:block")}>
              <Markdown source={body} />
            </div>
          </div>
        </Card>
      </div>
      <div className="grid content-start gap-4">
        <Card title="Page">
          <div className="grid gap-4">
            <Field label="Title">
              <Input name="title" defaultValue={page.title} maxLength={90} required />
            </Field>
            <Field label="Address" hint="Lowercase letters, numbers and dashes.">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] text-white/45">/p/</span>
                <Input name="slug" defaultValue={page.slug} maxLength={80} required className="font-mono text-[13.5px]" />
              </div>
            </Field>
            <Field label="Summary" hint="Shown under the title and in link previews.">
              <Textarea name="description" defaultValue={page.description} maxLength={300} className="min-h-20" />
            </Field>
            <Toggle name="published" defaultChecked={page.published} label="Published" hint="Drafts are only visible here." />
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Saving…">Save page</SubmitButton>
              {page.published && (
                <Link href={`/p/${page.slug}`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-bold hover:bg-white/15">
                  <ExternalLink className="size-4" /> View
                </Link>
              )}
            </div>
          </div>
        </Card>
        <Card title="Formatting">
          <dl className="grid gap-1.5 text-[13px]">
            {CHEATSHEET.map(([code, what]) => (
              <div key={code} className="flex justify-between gap-3">
                <dt className="font-mono text-white/80">{code}</dt>
                <dd className="text-white/45">{what}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <div>
          <ConfirmButton confirmLabel="Delete this page" onConfirm={() => removePage(page.slug)}>
            Delete page
          </ConfirmButton>
        </div>
      </div>
    </form>
  );
}
