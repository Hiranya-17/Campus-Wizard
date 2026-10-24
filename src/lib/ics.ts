import type { WeekEvent } from "@/lib/types";
import { DAYS } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Build an .ics calendar for one week. weekOf is the Monday, "2026-10-26". Times are Boston local. */
export function toIcs(weekOf: string, events: WeekEvent[]): string {
  const [y, m, d] = weekOf.split("-").map(Number);
  const stamp = (day: string, minutes: number) => {
    const date = new Date(Date.UTC(y, m - 1, d + DAYS.indexOf(day as never)));
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(Math.floor(minutes / 60) % 24)}${pad(minutes % 60)}00`;
  };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rhett//BU Week Planner//EN", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    if (e.kind === "sleep") continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}-${weekOf}@rhett`,
      `DTSTAMP:${stamp("Mon", 0)}`,
      `DTSTART;TZID=America/New_York:${stamp(e.day, e.start)}`,
      `DTEND;TZID=America/New_York:${stamp(e.day, Math.min(e.end, 1439))}`,
      `SUMMARY:${e.title.replace(/[,;]/g, " ")}`,
      ...(e.location ? [`LOCATION:${e.location}`] : []),
      "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", `DESCRIPTION:${e.title}`, "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
