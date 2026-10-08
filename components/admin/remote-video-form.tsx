"use client";

import { useActionState } from "react";
import { addRemoteVideo } from "@/app/chewy/(panel)/media/actions";
import type { ActionState } from "@/lib/admin/action";
import type { FolderOption } from "@/lib/admin/folders";
import { Card, Field, Input, Notice, Select, SubmitButton, Textarea } from "./ui";

export function RemoteVideoForm({ folders, categories, sources }: { folders: FolderOption[]; categories: { slug: string; label: string }[]; sources: { slug: string; label: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addRemoteVideo, {});
  return (
    <Card title="Add a video by link" description="For videos hosted elsewhere, like the Rockstar trailers. The server reads the video to make a poster and scrubber previews; the file itself keeps streaming from its host.">
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Notice tone="error">{state.error}</Notice>
        </div>
        <Field label="Video link (best quality)" className="md:col-span-2" hint="https only. The host must allow other sites to play it.">
          <Input name="url" type="url" required placeholder="https://videos-rockstargames-com.akamaized.net/…/en-us-2160p.mp4" maxLength={500} />
        </Field>
        <Field label="Smaller versions (optional)" className="md:col-span-2" hint="One link per line, e.g. the 1080p and 720p files. Used for everyday playback.">
          <Textarea name="renditions" className="min-h-20" maxLength={2000} />
        </Field>
        <Field label="Title">
          <Input name="title" required maxLength={160} />
        </Field>
        <Field label="Published">
          <Input name="datePublished" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Folder">
          <Select name="folderId" defaultValue="videos">
            <option value="">(No folder)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue="videos">
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source">
          <Select name="sourceSlug" defaultValue="rockstar-website">
            {sources.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <SubmitButton pendingLabel="Reading the video… (can take a minute)">Add video</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
