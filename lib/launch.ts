/**
 * Launch-time maths. The game unlocks at midnight on release day in each
 * time zone, so the release rolls around the world from UTC+14 to UTC−11.
 * Everything here is pure and runs in the browser using the platform's own
 * time zone database (Intl), so daylight saving is handled correctly.
 */

export interface Zone {
  tz: string;
  city: string;
  country: string;
}

/** A curated set of cities covering every inhabited UTC offset. */
export const ZONES: Zone[] = [
  { tz: "Pacific/Kiritimati", city: "Kiritimati", country: "Kiribati" },
  { tz: "Pacific/Chatham", city: "Chatham Islands", country: "New Zealand" },
  { tz: "Pacific/Auckland", city: "Auckland", country: "New Zealand" },
  { tz: "Pacific/Tongatapu", city: "Nukuʻalofa", country: "Tonga" },
  { tz: "Pacific/Apia", city: "Apia", country: "Samoa" },
  { tz: "Pacific/Fiji", city: "Suva", country: "Fiji" },
  { tz: "Pacific/Noumea", city: "Nouméa", country: "New Caledonia" },
  { tz: "Australia/Sydney", city: "Sydney", country: "Australia" },
  { tz: "Australia/Melbourne", city: "Melbourne", country: "Australia" },
  { tz: "Australia/Adelaide", city: "Adelaide", country: "Australia" },
  { tz: "Australia/Brisbane", city: "Brisbane", country: "Australia" },
  { tz: "Australia/Darwin", city: "Darwin", country: "Australia" },
  { tz: "Asia/Tokyo", city: "Tokyo", country: "Japan" },
  { tz: "Asia/Seoul", city: "Seoul", country: "South Korea" },
  { tz: "Australia/Perth", city: "Perth", country: "Australia" },
  { tz: "Asia/Shanghai", city: "Shanghai", country: "China" },
  { tz: "Asia/Hong_Kong", city: "Hong Kong", country: "Hong Kong" },
  { tz: "Asia/Taipei", city: "Taipei", country: "Taiwan" },
  { tz: "Asia/Singapore", city: "Singapore", country: "Singapore" },
  { tz: "Asia/Manila", city: "Manila", country: "Philippines" },
  { tz: "Asia/Kuala_Lumpur", city: "Kuala Lumpur", country: "Malaysia" },
  { tz: "Asia/Bangkok", city: "Bangkok", country: "Thailand" },
  { tz: "Asia/Jakarta", city: "Jakarta", country: "Indonesia" },
  { tz: "Asia/Ho_Chi_Minh", city: "Ho Chi Minh City", country: "Vietnam" },
  { tz: "Asia/Dhaka", city: "Dhaka", country: "Bangladesh" },
  { tz: "Asia/Kathmandu", city: "Kathmandu", country: "Nepal" },
  { tz: "Asia/Kolkata", city: "Mumbai", country: "India" },
  { tz: "Asia/Karachi", city: "Karachi", country: "Pakistan" },
  { tz: "Asia/Tashkent", city: "Tashkent", country: "Uzbekistan" },
  { tz: "Asia/Dubai", city: "Dubai", country: "United Arab Emirates" },
  { tz: "Asia/Tehran", city: "Tehran", country: "Iran" },
  { tz: "Asia/Riyadh", city: "Riyadh", country: "Saudi Arabia" },
  { tz: "Asia/Qatar", city: "Doha", country: "Qatar" },
  { tz: "Asia/Kuwait", city: "Kuwait City", country: "Kuwait" },
  { tz: "Europe/Istanbul", city: "Istanbul", country: "Türkiye" },
  { tz: "Europe/Moscow", city: "Moscow", country: "Russia" },
  { tz: "Africa/Nairobi", city: "Nairobi", country: "Kenya" },
  { tz: "Africa/Cairo", city: "Cairo", country: "Egypt" },
  { tz: "Europe/Athens", city: "Athens", country: "Greece" },
  { tz: "Europe/Helsinki", city: "Helsinki", country: "Finland" },
  { tz: "Europe/Kyiv", city: "Kyiv", country: "Ukraine" },
  { tz: "Africa/Johannesburg", city: "Johannesburg", country: "South Africa" },
  { tz: "Europe/Berlin", city: "Berlin", country: "Germany" },
  { tz: "Europe/Paris", city: "Paris", country: "France" },
  { tz: "Europe/Madrid", city: "Madrid", country: "Spain" },
  { tz: "Europe/Rome", city: "Rome", country: "Italy" },
  { tz: "Europe/Amsterdam", city: "Amsterdam", country: "Netherlands" },
  { tz: "Europe/Stockholm", city: "Stockholm", country: "Sweden" },
  { tz: "Europe/Warsaw", city: "Warsaw", country: "Poland" },
  { tz: "Africa/Lagos", city: "Lagos", country: "Nigeria" },
  { tz: "Africa/Casablanca", city: "Casablanca", country: "Morocco" },
  { tz: "Europe/London", city: "London", country: "United Kingdom" },
  { tz: "Europe/Dublin", city: "Dublin", country: "Ireland" },
  { tz: "Europe/Lisbon", city: "Lisbon", country: "Portugal" },
  { tz: "Atlantic/Reykjavik", city: "Reykjavík", country: "Iceland" },
  { tz: "Atlantic/Azores", city: "Azores", country: "Portugal" },
  { tz: "America/Sao_Paulo", city: "São Paulo", country: "Brazil" },
  { tz: "America/Argentina/Buenos_Aires", city: "Buenos Aires", country: "Argentina" },
  { tz: "America/Santiago", city: "Santiago", country: "Chile" },
  { tz: "America/St_Johns", city: "St. John's", country: "Canada" },
  { tz: "America/Halifax", city: "Halifax", country: "Canada" },
  { tz: "America/Puerto_Rico", city: "San Juan", country: "Puerto Rico" },
  { tz: "America/Caracas", city: "Caracas", country: "Venezuela" },
  { tz: "America/New_York", city: "New York", country: "United States" },
  { tz: "America/Toronto", city: "Toronto", country: "Canada" },
  { tz: "America/Bogota", city: "Bogotá", country: "Colombia" },
  { tz: "America/Lima", city: "Lima", country: "Peru" },
  { tz: "America/Chicago", city: "Chicago", country: "United States" },
  { tz: "America/Mexico_City", city: "Mexico City", country: "Mexico" },
  { tz: "America/Denver", city: "Denver", country: "United States" },
  { tz: "America/Phoenix", city: "Phoenix", country: "United States" },
  { tz: "America/Los_Angeles", city: "Los Angeles", country: "United States" },
  { tz: "America/Vancouver", city: "Vancouver", country: "Canada" },
  { tz: "America/Anchorage", city: "Anchorage", country: "United States" },
  { tz: "Pacific/Honolulu", city: "Honolulu", country: "United States" },
  { tz: "Pacific/Pago_Pago", city: "Pago Pago", country: "American Samoa" },
];

/** Offset of a time zone from UTC at a given instant, in minutes (UTC+13 → 780). */
export function tzOffsetMinutes(tz: string, at: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60000);
}

/** The instant (ms since epoch) when it is midnight on `date` (YYYY-MM-DD) in `tz`. */
export function launchInstant(date: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Two passes settle daylight-saving transitions near midnight.
  let t = wall - tzOffsetMinutes(tz, wall) * 60000;
  t = wall - tzOffsetMinutes(tz, t) * 60000;
  return t;
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "−";
  const a = Math.abs(minutes);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** "Europe/London" → "London" when the zone isn't in ZONES. */
export function zoneLabel(tz: string): { city: string; country: string } {
  const z = ZONES.find((x) => x.tz === tz);
  if (z) return { city: z.city, country: z.country };
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  return { city, country: tz.includes("/") ? tz.split("/")[0] : "" };
}

/* ------------------------------------------------------------------ */
/* Breakdowns                                                          */
/* ------------------------------------------------------------------ */

export type ClockMode = "days" | "weeks" | "months" | "hours" | "minutes" | "seconds";

export const CLOCK_MODES: { mode: ClockMode; label: string }[] = [
  { mode: "days", label: "Days" },
  { mode: "weeks", label: "Weeks" },
  { mode: "months", label: "Months" },
  { mode: "hours", label: "Hours" },
  { mode: "minutes", label: "Minutes" },
  { mode: "seconds", label: "Seconds" },
];

export interface Unit {
  key: string;
  label: string;
  value: number;
  /** Minimum digits to show (e.g. 2 for hours). */
  pad: number;
}

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;
const W = 7 * D;

/** Whole calendar months from `from` to `to`, and the instant after adding them. */
function wholeMonths(from: number, to: number): { months: number; after: number } {
  const a = new Date(from);
  let months = (new Date(to).getUTCFullYear() - a.getUTCFullYear()) * 12 + (new Date(to).getUTCMonth() - a.getUTCMonth());
  const add = (n: number) => {
    const d = new Date(from);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.getTime();
  };
  while (months > 0 && add(months) > to) months--;
  return { months: Math.max(0, months), after: add(Math.max(0, months)) };
}

/** Splits a span of time into units for the chosen mode. */
export function breakdown(ms: number, mode: ClockMode, now = Date.now()): Unit[] {
  const t = Math.max(0, ms);
  const sec = Math.floor((t % M) / S);
  const min = Math.floor((t % H) / M);
  const hr = Math.floor((t % D) / H);
  switch (mode) {
    case "weeks":
      return [
        { key: "w", label: "Weeks", value: Math.floor(t / W), pad: 1 },
        { key: "d", label: "Days", value: Math.floor((t % W) / D), pad: 1 },
        { key: "h", label: "Hours", value: hr, pad: 2 },
        { key: "m", label: "Minutes", value: min, pad: 2 },
        { key: "s", label: "Seconds", value: sec, pad: 2 },
      ];
    case "months": {
      const { months, after } = wholeMonths(now, now + t);
      const rest = Math.max(0, now + t - after);
      return [
        { key: "mo", label: months === 1 ? "Month" : "Months", value: months, pad: 1 },
        { key: "d", label: "Days", value: Math.floor(rest / D), pad: 1 },
        { key: "h", label: "Hours", value: Math.floor((rest % D) / H), pad: 2 },
        { key: "m", label: "Minutes", value: Math.floor((rest % H) / M), pad: 2 },
        { key: "s", label: "Seconds", value: Math.floor((rest % M) / S), pad: 2 },
      ];
    }
    case "hours":
      return [
        { key: "h", label: "Hours", value: Math.floor(t / H), pad: 1 },
        { key: "m", label: "Minutes", value: min, pad: 2 },
        { key: "s", label: "Seconds", value: sec, pad: 2 },
      ];
    case "minutes":
      return [
        { key: "m", label: "Minutes", value: Math.floor(t / M), pad: 1 },
        { key: "s", label: "Seconds", value: sec, pad: 2 },
      ];
    case "seconds":
      return [{ key: "s", label: "Seconds", value: Math.floor(t / S), pad: 1 }];
    default:
      return [
        { key: "d", label: "Days", value: Math.floor(t / D), pad: 1 },
        { key: "h", label: "Hours", value: hr, pad: 2 },
        { key: "m", label: "Minutes", value: min, pad: 2 },
        { key: "s", label: "Seconds", value: sec, pad: 2 },
      ];
  }
}

/** "18 hours" / "2 days 4 hours" — a compact human duration. */
export function humanSpan(ms: number): string {
  const t = Math.abs(ms);
  if (t < M) return "less than a minute";
  const d = Math.floor(t / D);
  const h = Math.floor((t % D) / H);
  const m = Math.floor((t % H) / M);
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (!d && m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.slice(0, 2).join(" ");
}

/** A launch time shown in the viewer's own zone, e.g. "Wed, Nov 18, 1:00 PM". */
export function formatInZone(at: number, tz: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(at));
}
