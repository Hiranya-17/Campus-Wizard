import "server-only";
import { getValidAccessToken } from "@/lib/google/oauth";
import type { WeekEvent } from "@/lib/types";
import { DAYS } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEventResult {
  eventId: string;       // WeekEvent.id
  title: string;
  status: "created" | "skipped" | "failed";
  googleId?: string;     // Google Calendar event id, present on "created"
  error?: string;        // present on "failed"
}

export interface ExportResult {
  created: number;
  skipped: number;
  failed: CalendarEventResult[];
  results: CalendarEventResult[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const TZ = "America/New_York";

/**
 * Build the stable iCalUID for a WeekEvent — must match the scheme used in
 * src/lib/ics.ts so .ics downloads and Calendar exports share the same UID.
 */
function iCalUID(event: WeekEvent, weekOf: string): string {
  return `${event.id}-${weekOf}@rhett`;
}

/**
 * Convert a WeekEvent into an RFC 3339 datetime string in America/New_York.
 * weekOf is the Monday ISO date ("2026-10-26"), minutes are minutes after midnight.
 */
function toRfc3339(weekOf: string, day: WeekEvent["day"], minutes: number): string {
  const [y, m, d] = weekOf.split("-").map(Number);
  // Offset from Monday (index 0) to the target day
  const dayOffset = DAYS.indexOf(day);
  const date = new Date(Date.UTC(y, m - 1, d + dayOffset));

  // Format as YYYY-MM-DD
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const min = String(minutes % 60).padStart(2, "0");

  // Return as a local datetime string with IANA timezone — the Calendar API
  // accepts "dateTime" + "timeZone" separately rather than a UTC offset string
  return `${yy}-${mm}-${dd}T${hh}:${min}:00`;
}

/** Build a human-readable date string for the preview ("Mon Oct 26"). */
export function previewDate(weekOf: string, day: WeekEvent["day"]): string {
  const [y, m, d] = weekOf.split("-").map(Number);
  const dayOffset = DAYS.indexOf(day);
  const date = new Date(Date.UTC(y, m - 1, d + dayOffset));
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Google Calendar API helpers
// ---------------------------------------------------------------------------

interface CalendarListResponse {
  items?: { id: string }[];
}

interface CalendarEvent {
  id?: string;
  iCalUID?: string;
}

interface CalendarEventsListResponse {
  items?: CalendarEvent[];
}

async function calFetch(
  userId: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error("No valid Google token. Please reconnect Google.");

  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 401) throw new Error("Google token expired. Please reconnect Google.");
  if (res.status === 404) return null;

  const text = await res.text();
  if (!res.ok) throw new Error(`Calendar API ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/**
 * Check if an event with this iCalUID already exists in the primary calendar.
 * Returns the Google event id if found, null otherwise.
 */
async function findByICalUID(userId: string, uid: string): Promise<string | null> {
  const data = (await calFetch(
    userId,
    `/calendars/primary/events?iCalUID=${encodeURIComponent(uid)}&fields=items(id,iCalUID)`,
  )) as CalendarEventsListResponse | null;
  return data?.items?.[0]?.id ?? null;
}

/**
 * Insert one event into the primary calendar.
 * Returns the created Google event id.
 */
async function insertEvent(
  userId: string,
  event: WeekEvent,
  weekOf: string,
): Promise<string> {
  const uid = iCalUID(event, weekOf);
  const start = toRfc3339(weekOf, event.day, event.start);
  const end = toRfc3339(weekOf, event.day, Math.min(event.end, 1439));

  const body = {
    iCalUID: uid,
    summary: event.title,
    ...(event.location ? { location: event.location } : {}),
    start: { dateTime: start, timeZone: TZ },
    end: { dateTime: end, timeZone: TZ },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 10 }],
    },
  };

  const created = (await calFetch(userId, "/calendars/primary/events", {
    method: "POST",
    body,
  })) as CalendarEvent;

  if (!created?.id) throw new Error("Calendar API returned no event id");
  return created.id;
}

// ---------------------------------------------------------------------------
// Public export function
// ---------------------------------------------------------------------------

/**
 * Export a week plan to the user's primary Google Calendar.
 *
 * - Skips "sleep" events (same as the .ics export).
 * - Checks for existing events by iCalUID before inserting — safe to call
 *   repeatedly; already-exported events are counted as "skipped".
 * - Returns per-event results so the caller can report partial failures.
 */
export async function exportWeekToCalendar(
  userId: string,
  weekOf: string,
  events: WeekEvent[],
): Promise<ExportResult> {
  // Verify the token is reachable before iterating
  const token = await getValidAccessToken(userId);
  if (!token) {
    throw new Error("No valid Google token. Please reconnect Google.");
  }

  // Filter out sleep events — same policy as .ics
  const exportable = events.filter((e) => e.kind !== "sleep");

  const results: CalendarEventResult[] = [];

  for (const event of exportable) {
    const uid = iCalUID(event, weekOf);
    try {
      const existingId = await findByICalUID(userId, uid);
      if (existingId) {
        results.push({ eventId: event.id, title: event.title, status: "skipped", googleId: existingId });
        continue;
      }
      const googleId = await insertEvent(userId, event, weekOf);
      results.push({ eventId: event.id, title: event.title, status: "created", googleId });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      results.push({ eventId: event.id, title: event.title, status: "failed", error });
    }
  }

  return {
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed"),
    results,
  };
}

// ---------------------------------------------------------------------------
// Calendar list (used by status check)
// ---------------------------------------------------------------------------

/** Returns true if the token can reach the Calendar API (primary calendar accessible). */
export async function calendarAccessible(userId: string): Promise<boolean> {
  try {
    const data = (await calFetch(
      userId,
      "/users/me/calendarList?maxResults=1&fields=items(id)",
    )) as CalendarListResponse | null;
    return Array.isArray(data?.items);
  } catch {
    return false;
  }
}
