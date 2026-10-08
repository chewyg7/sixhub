import type { MediaSource } from "@/types/content";

const ROCKSTAR_VI = "https://www.rockstargames.com/VI";

/** Sources the database starts with; owners manage them in the admin panel afterwards. */
export const MEDIA_SOURCES: MediaSource[] = [
  { slug: "trailer-1", label: "Trailer 1", origin: "trailer", url: ROCKSTAR_VI, date: "2023-12-04" },
  { slug: "trailer-2", label: "Trailer 2", origin: "trailer", url: ROCKSTAR_VI, date: "2025-05-06" },
  { slug: "rockstar-website", label: "Rockstar Games website", origin: "website", url: ROCKSTAR_VI },
  { slug: "rockstar-newswire", label: "Rockstar Newswire", origin: "newswire", url: "https://www.rockstargames.com/newswire" },
  { slug: "campaign", label: "Marketing campaign", origin: "press" },
  { slug: "extended-look", label: "An Extended Look", origin: "trailer", url: ROCKSTAR_VI, date: "2026-08-27" },
  { slug: "press", label: "Official previews", origin: "press" },
  { slug: "music", label: "Soundtrack partners", origin: "social" },
  { slug: "rockstar-store", label: "Rockstar Store", origin: "website", url: "https://store.rockstargames.com" },
  { slug: "community", label: "Community", origin: "other" },
];
