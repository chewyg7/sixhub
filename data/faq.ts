import type { FaqEntry } from "@/types/content";

/** FAQ the database starts with; owners edit, reorder and add questions in the admin panel. */
const q = (id: string, group: string, sort: number, question: string, answer: string, featured = false): FaqEntry => ({
  id,
  group,
  sort,
  question,
  answer,
  published: true,
  featured,
});

export const DEFAULT_FAQ: FaqEntry[] = [
  q(
    "release-date",
    "The game",
    1,
    "When does Grand Theft Auto VI come out?",
    "Grand Theft Auto VI is scheduled for November 19, 2026. The countdown at the top of the home page tracks it live.\n\nThe release date has moved twice: Trailer 1 announced a 2025 window, it was then set for May 26, 2026, and later moved to November 19, 2026. Each change is on the timeline with a link to the announcement.",
    true,
  ),
  q(
    "launch-time",
    "The game",
    2,
    "What time does it unlock where I live?",
    "Digital releases like this usually unlock at midnight local time, so the launch rolls around the world one time zone at a time, starting with Kiribati's Line Islands and New Zealand and ending with Hawaii and American Samoa.\n\nThe countdown uses your own time zone by default. Open the time zone list under it to see when the game unlocks anywhere else, which regions are already live, and how long each one has left.",
    true,
  ),
  q(
    "platforms",
    "The game",
    3,
    "Which platforms is it on?",
    "Rockstar has announced Grand Theft Auto VI for PlayStation 5 and Xbox Series X|S. A PC version has not been announced.",
    true,
  ),
  q(
    "setting",
    "The game",
    4,
    "Where is it set, and who are the main characters?",
    "The game is set in the state of Leonida, home to Vice City, the Leonida Keys, Grassrivers, Port Gellhorn, Ambrosia and Mount Kalaga National Park. The protagonists are Jason Duval and Lucia Caminos. Every character and region has a page in the Leonida section with the media they appear in.",
  ),
  q(
    "what-is",
    "This site",
    10,
    "What is GTA 6 Hub?",
    "A fan-made home for everything official about Grand Theft Auto VI: the latest news, an archive of every screenshot, screengrab, artwork, trailer, logo and font, a frame-by-frame Media Viewer, and a database of the characters and places of Leonida.",
    true,
  ),
  q(
    "official",
    "This site",
    11,
    "Is GTA 6 Hub affiliated with Rockstar Games?",
    "No. GTA 6 Hub is an independent fan site. It isn't affiliated with, endorsed by or sponsored by Rockstar Games or Take-Two Interactive. Official media belongs to Rockstar Games, and news stories link back to their publishers.",
  ),
  q(
    "downloads",
    "This site",
    12,
    "Can I download the images and fonts?",
    "Yes. Images, logos and fonts have a download button on their page with the full-resolution original. Trailers stream from Rockstar's own servers and can't be downloaded here.",
  ),
  q(
    "viewer",
    "This site",
    13,
    "What can the Media Viewer do?",
    "Step through trailers frame by frame, zoom in to 400% and inspect pixels, crop and save stills at full resolution, adjust brightness and colour, and compare two shots side by side. You can also open your own images and videos in it; they never leave your device.",
  ),
  q(
    "screengrabs",
    "This site",
    14,
    "What's the difference between screenshots and screengrabs?",
    "Screenshots are images Rockstar released as screenshots. Screengrabs are frames captured from the trailers and the official website. They live in separate folders in the media archive.",
  ),
  q(
    "community",
    "Community",
    20,
    "How do I join the community?",
    "Join the GTA 6 Hub Discord, follow @gtasixinfo on X for news and @gtasixhub on Instagram. Links are in the site footer and menu.",
    true,
  ),
  q(
    "submit",
    "Community",
    21,
    "I found media that's missing. How do I send it in?",
    "Post it in our Discord with a link to where it was first published. The team checks submissions and adds official media to the archive.",
  ),
];
