"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search } from "lucide-react";
import type { ActionState } from "@/lib/admin/action";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, ConfirmButton, Field, Input, Notice, Select, SubmitButton, Textarea } from "./ui";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number" | "date" | "url" | "toggle" | "code";
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  wide?: boolean;
  placeholder?: string;
  /** Only editable when creating (e.g. a slug used as the primary key). */
  createOnly?: boolean;
  rows?: number;
}

export interface RecordItem {
  key: string;
  title: string;
  subtitle?: string;
  badge?: string;
  values: Record<string, string | boolean>;
}

type Save = (prev: ActionState, form: FormData) => Promise<ActionState>;

function RecordForm({ fields, values, save, isNew, onDone }: { fields: FieldDef[]; values: Record<string, string | boolean>; save: Save; isNew: boolean; onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(save, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.n, state.ok, router, onDone]);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:grid-cols-2">
      <input type="hidden" name="_key" value={isNew ? "" : String(values._key ?? "")} />
      <div className="sm:col-span-2">
        <Notice tone="error">{state.error}</Notice>
      </div>
      {fields.map((f) => {
        const v = values[f.name];
        const readOnly = f.createOnly && !isNew;
        const common = { name: f.name, required: f.required, placeholder: f.placeholder, readOnly };
        return (
          <Field key={f.name} label={f.label} hint={readOnly ? "Can't be changed after creation." : f.hint} className={f.wide || f.type === "textarea" || f.type === "code" ? "sm:col-span-2" : undefined}>
            {f.type === "textarea" || f.type === "code" ? (
              <Textarea {...common} defaultValue={String(v ?? "")} rows={f.rows ?? 4} className={cn(f.type === "code" && "font-mono text-[13px]")} spellCheck={f.type !== "code"} />
            ) : f.type === "select" ? (
              <Select name={f.name} defaultValue={String(v ?? "")} disabled={readOnly}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : f.type === "toggle" ? (
              <label className="flex h-11 items-center gap-3">
                <input type="checkbox" name={f.name} defaultChecked={v === true || v === "true"} className="size-5 accent-[#ff4fa3]" />
                <span className="text-[14px] text-white/70">{f.placeholder ?? "Yes"}</span>
              </label>
            ) : (
              <Input {...common} type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text"} defaultValue={String(v ?? "")} />
            )}
          </Field>
        );
      })}
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">{isNew ? "Create" : "Save"}</SubmitButton>
        <Button tone="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** A searchable list of records with inline create, edit and delete. */
export function RecordList({
  title,
  description,
  items,
  fields,
  save,
  remove,
  newLabel = "New",
  blank = {},
  searchable = true,
}: {
  title: string;
  description?: string;
  items: RecordItem[];
  fields: FieldDef[];
  save: Save;
  remove?: (key: string) => Promise<ActionState>;
  newLabel?: string;
  blank?: Record<string, string | boolean>;
  searchable?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<ActionState>({});
  const [busy, start] = useTransition();
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? items.filter((i) => `${i.title} ${i.subtitle ?? ""} ${i.key}`.toLowerCase().includes(n)) : items;
  }, [items, q]);

  return (
    <Card
      title={title}
      description={description}
      actions={
        <Button tone="primary" size="sm" onClick={() => setEditing("__new")}>
          <Plus /> {newLabel}
        </Button>
      }
    >
      <div className="grid gap-3">
        <Notice tone="success">{msg.ok}</Notice>
        <Notice tone="error">{msg.error}</Notice>
        {editing === "__new" && <RecordForm fields={fields} values={blank} save={save} isNew onDone={() => setEditing(null)} />}
        {searchable && items.length > 8 && (
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/40" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${items.length} ${title.toLowerCase()}`} className="pl-10" />
          </label>
        )}
        <ul className="divide-y divide-white/8">
          {shown.map((i) => (
            <li key={i.key} className="py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] font-bold">{i.title}</span>
                    {i.badge && <Badge>{i.badge}</Badge>}
                  </span>
                  {i.subtitle && <span className="block truncate text-[12.5px] text-white/45">{i.subtitle}</span>}
                </span>
                <Button size="sm" tone="ghost" onClick={() => setEditing(editing === i.key ? null : i.key)}>
                  <Pencil /> Edit
                </Button>
                {remove && (
                  <ConfirmButton
                    tone="ghost"
                    disabled={busy}
                    confirmLabel="Delete"
                    onConfirm={() =>
                      start(async () => {
                        setMsg(await remove(i.key));
                        router.refresh();
                      })
                    }
                  >
                    Delete
                  </ConfirmButton>
                )}
              </div>
              {editing === i.key && (
                <div className="mt-3">
                  <RecordForm fields={fields} values={{ ...i.values, _key: i.key }} save={save} isNew={false} onDone={() => setEditing(null)} />
                </div>
              )}
            </li>
          ))}
          {shown.length === 0 && <li className="py-8 text-center text-[14px] text-white/45">Nothing here yet.</li>}
        </ul>
      </div>
    </Card>
  );
}
