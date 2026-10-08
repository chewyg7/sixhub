"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { reviewMedia } from "@/app/chewy/(panel)/media/actions";
import type { ActionState } from "@/lib/admin/action";
import { Button, ConfirmButton, Notice } from "./ui";
import { formatTime } from "./format";

export function ReviewList({ items }: { items: { slug: string; title: string; kind: string; folder: string; by: string; at: number; thumb: string | null }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<ActionState>({});
  const [busy, start] = useTransition();
  const decide = (slug: string, d: "approve" | "reject") =>
    start(async () => {
      setMsg(await reviewMedia(slug, d));
      router.refresh();
    });
  return (
    <div className="grid gap-4">
      <Notice tone="success">{msg.ok}</Notice>
      <Notice tone="error">{msg.error}</Notice>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <li key={i.slug} className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]">
            <Link href={`/chewy/media/${i.slug}`} className="block aspect-video bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
              {i.thumb && <img src={i.thumb} alt="" className="size-full object-cover" />}
            </Link>
            <div className="p-5">
              <p className="text-[16px] font-bold">{i.title}</p>
              <p className="mt-1 text-[13px] text-white/55">
                {i.kind} · {i.folder} · by @{i.by} · {formatTime(i.at)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button tone="primary" size="sm" disabled={busy} onClick={() => decide(i.slug, "approve")}>
                  <Check /> Approve
                </Button>
                <Link href={`/chewy/media/${i.slug}`} className="inline-flex h-9 items-center rounded-full bg-white/10 px-3.5 text-[13px] font-bold hover:bg-white/15">
                  Edit first
                </Link>
                <ConfirmButton disabled={busy} confirmLabel="Reject & delete" onConfirm={() => decide(i.slug, "reject")}>
                  Reject
                </ConfirmButton>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
