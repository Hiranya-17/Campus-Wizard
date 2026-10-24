import type { Assignment, WeekEvent } from "@/lib/types";
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

/**
 * Exams and homework from syllabi as calendar events with reminders:
 * exams and quizzes 1 week, 2 days and 1 day before; homework, projects and papers 1 day and 2 hours before.
 * Items without a time are due at the end of the day.
 */
export function assignmentsToIcs(items: Assignment[]): string {
  const stamp = (date: string, minutes: number) => `${date.replace(/-/g, "")}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, " ");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rhett//BU Syllabus//EN", "CALSCALE:GREGORIAN"];
  for (const a of items) {
    const isTest = a.kind === "exam" || a.kind === "quiz";
    const start = a.time ?? 23 * 60; // due at end of day
    const end = isTest ? Math.min(1439, start + 90) : Math.min(1439, start + 59);
    const course = a.courseCode.split(" ").slice(1).join(" ");
    const alarms = isTest ? ["-P7D", "-P2D", "-P1D"] : ["-P1D", "-PT2H"];
    lines.push(
      "BEGIN:VEVENT",
      `UID:${a.id}@rhett`,
      `DTSTAMP:${stamp(a.date, 0)}`,
      `DTSTART;TZID=America/New_York:${stamp(a.date, start)}`,
      `DTEND;TZID=America/New_York:${stamp(a.date, end)}`,
      `SUMMARY:${esc(`${isTest ? "" : "Due: "}${course} ${a.title}`)}`,
      `DESCRIPTION:${esc([a.weight ? `${a.weight}% of grade` : "", a.topics.length ? `Covers: ${a.topics.join(", ")}` : ""].filter(Boolean).join(". ") || a.kind)}`,
      ...alarms.flatMap((t) => ["BEGIN:VALARM", `TRIGGER:${t}`, "ACTION:DISPLAY", `DESCRIPTION:${esc(`${course} ${a.title}`)}`, "END:VALARM"]),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
