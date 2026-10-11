import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Breadcrumbs, Container } from "@/components/layout/page";
import { RepoWarning } from "@/features/repos/repo-bits";

export const metadata: Metadata = { title: "Making a repo", robots: { index: false, follow: false } };

const EXAMPLE = `{
  "name": "Leonida Night Drives",
  "author": "exid",
  "description": "Night-time stills I captured from Trailer 2.",
  "icon": "icon.png",
  "website": "https://example.com",
  "items": [
    {
      "title": "Ocean Drive at 2am",
      "url": "images/ocean-drive.jpg",
      "thumbnail": "thumbs/ocean-drive.jpg",
      "folder": "Vice City",
      "description": "Neon and rain.",
      "credit": "Rockstar Games"
    },
    {
      "title": "Highway clip",
      "type": "video",
      "url": "https://cdn.example.com/highway.mp4",
      "thumbnail": "thumbs/highway.jpg",
      "folder": "Clips"
    }
  ]
}`;

const FIELDS: [string, string][] = [
  ["name", "Required. The repo's name (up to 60 characters)."],
  ["author", "Who made it. Shown on the share page and the repo."],
  ["description", "A sentence or two about what's inside."],
  ["icon", "A square image. Without one, the first letter of the name is used."],
  ["website", "Optional link to you or your project."],
  ["items", "Required. The list of media, up to 5,000 entries."],
];

const ITEM_FIELDS: [string, string][] = [
  ["url", "Required. A direct link to the file itself (not a page that shows it)."],
  ["title", "The item's name. Defaults to the file name."],
  ["type", "image, video or audio. Worked out from the file extension if left out."],
  ["thumbnail", "A small preview image. Strongly recommended for videos and very large images."],
  ["folder", "Groups items into tabs inside the repo."],
  ["description", "Shown under the item when it's open."],
  ["credit", "Who made or captured it."],
];

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-12 mb-3 text-[22px] font-bold text-white">{children}</h2>;
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
          <dt>
            <code className="text-[13.5px] font-bold text-accent-text">{k}</code>
          </dt>
          <dd className="text-[14px] text-white/65">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const code = "rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[13px] text-white/85";

/** Unlisted: linked only, quietly, from My repos. */
export default function RepoGuidePage() {
  return (
    <Container>
      <div className="mx-auto max-w-3xl pt-10 pb-20 text-[15.5px] leading-relaxed text-white/70 sm:pt-16">
        <Breadcrumbs items={[{ href: "/media", label: "Media" }, { href: "/media/repos", label: "My repos" }, { label: "Making a repo" }]} className="mb-6" />
        <h1 className="display-xl text-[52px] leading-[0.95] text-white sm:text-[84px]">Making a repo</h1>
        <p className="mt-5">
          A repo is a single <code className={code}>.json</code> file that lists media by link. You host the file and the media wherever you like. People add it in My repos (or through your share link) and their browser loads
          everything straight from your links.
        </p>
        <RepoWarning className="mt-6" />

        <H2>1. Write the file</H2>
        <pre className="no-scrollbar overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-5 text-[13px] leading-relaxed text-white/85">
          <code>{EXAMPLE}</code>
        </pre>
        <p className="mt-3">
          Links can be full <code className={code}>https://</code> addresses, or paths relative to the JSON file (like <code className={code}>images/ocean-drive.jpg</code>), which is handy when the media sits next to it.
        </p>

        <H2>The repo</H2>
        <Table rows={FIELDS} />
        <H2>Each item</H2>
        <Table rows={ITEM_FIELDS} />
        <p className="mt-3 text-[14px] text-white/50">
          Supported: JPEG, PNG, WebP, GIF, AVIF and SVG images; MP4, WebM and MOV video; MP3, M4A, WAV, OGG and FLAC audio. Entries with other files, or links that aren’t https, are skipped.
        </p>

        <H2>2. Host it</H2>
        <p>
          The file has to be on <code className={code}>https</code> and readable by other websites (CORS). These work out of the box:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-white">GitHub:</strong> commit <code className={code}>repo.json</code> (and your media) to a public repository, open the file and copy the <strong className="text-white">Raw</strong> link (
            <code className={code}>raw.githubusercontent.com/…</code>).
          </li>
          <li>
            <strong className="text-white">GitHub Gist:</strong> make a public gist with the JSON and use its <strong className="text-white">Raw</strong> link.
          </li>
          <li>
            <strong className="text-white">Your own site:</strong> serve the file with the header <code className={code}>Access-Control-Allow-Origin: *</code>.
          </li>
        </ul>
        <p className="mt-3">
          The JSON can be up to 5 MB. Images and videos load like any embed, so use a host that allows hotlinking and can handle the traffic.
        </p>

        <H2>3. Share it</H2>
        <p>
          Add your repo in My repos, open it and press <strong className="text-white">Share</strong>. That gives you a link that opens a page showing your repo’s name, icon, author and contents, with a button to add it. Anyone with the
          link can add that one repo, even if they haven’t turned repos on.
        </p>
        <p className="mt-3">Edits to your JSON show up for everyone the next time they open the repo. Nothing is copied to GTA 6 Hub.</p>

        <H2>Be a good repo author</H2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Only list media you have the right to share, and credit the people who made it.</li>
          <li>Keep it about GTA VI. Nothing harmful, illegal or misleading.</li>
          <li>Don’t point items at pages that ask people for logins or downloads.</li>
        </ul>
      </div>
    </Container>
  );
}
