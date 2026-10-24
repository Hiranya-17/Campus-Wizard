import type { Assignment, AssignmentKind, Day, StudyPriority, WeekEvent } from "@/lib/types";
import { DAYS } from "@/lib/types";

const DAY_MS = 86_400_000;

/** How much an assignment usually counts when the syllabus doesn't say (% of grade). */
const DEFAULT_WEIGHT: Record<AssignmentKind, number> = { exam: 20, quiz: 5, homework: 3, project: 15, paper: 10 };
/** Study hours to suggest per 10% of the grade, by kind. */
const HOURS_PER_10PCT: Record<AssignmentKind, number> = { exam: 3, quiz: 2, homework: 1.5, project: 2, paper: 2 };

export const shortCourse = (code: string) => code.split(" ").slice(1).join(" "); // "CAS MA 226" -> "MA 226"

/** Classify a syllabus line or title. */
export function kindOf(text: string): AssignmentKind | null {
  const t = text.toLowerCase();
  if (/\b(final|midterm|exam|test)\b/.test(t)) return "exam";
  if (/\bquiz/.test(t)) return "quiz";
  if (/\b(project|presentation|lab report)\b/.test(t)) return "project";
  if (/\b(paper|essay|report)\b/.test(t)) return "paper";
  if (/\b(hw|homework|problem set|pset|assignment|due)\b/.test(t)) return "homework";
  return null;
}

/** Days from `now` (local midnight) to the assignment's date; negative if past. */
export function daysUntil(a: Assignment, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const [y, m, d] = a.date.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - today) / DAY_MS);
}

/**
 * What to work on, most urgent first. Score = weight (% of grade) / (days left + 1), so a 25% midterm
 * in 4 days outranks a 3% homework due tomorrow, but homework due today still shows up.
 */
export function studyPriorities(assignments: Assignment[], now = new Date(), horizonDays = 21): StudyPriority[] {
  return assignments
    .map((a) => ({ a, days: daysUntil(a, now) }))
    .filter(({ days }) => days >= 0 && days <= horizonDays)
    .map(({ a, days }) => {
      const weight = a.weight ?? DEFAULT_WEIGHT[a.kind];
      const score = Math.round((weight / (days + 1)) * 10) / 10;
      const suggestedHours = Math.max(1, Math.round((weight / 10) * HOURS_PER_10PCT[a.kind] * 2) / 2);
      const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
      const advice =
        a.kind === "exam" || a.kind === "quiz"
          ? `${a.topics.length ? `Review: ${a.topics.slice(0, 4).join(", ")}. ` : ""}Aim for about ${suggestedHours}h of study ${days === 0 ? "today" : days === 1 ? "before tomorrow" : `over the next ${days} days`}.`
          : `${a.kind === "homework" ? "Finish and submit" : "Work on it"}: due ${when}${a.topics.length ? ` (${a.topics.slice(0, 3).join(", ")})` : ""}.`;
      return { assignment: a, daysLeft: days, score, suggestedHours, advice };
    })
    .sort((x, y) => y.score - x.score || x.daysLeft - y.daysLeft);
}

/** Study emphasis for the week planner: each course weighted by its upcoming work. */
export function studyFocus(assignments: Assignment[], now = new Date()): { subject: string; weight: number; label: string }[] {
  const byCourse = new Map<string, { weight: number; label: string }>();
  for (const p of studyPriorities(assignments, now, 14)) {
    const subject = shortCourse(p.assignment.courseCode);
    const cur = byCourse.get(subject);
    if (!cur) byCourse.set(subject, { weight: p.score, label: `${subject} ${p.assignment.title}` });
    else cur.weight += p.score;
  }
  return [...byCourse.entries()].map(([subject, v]) => ({ subject, ...v })).sort((a, b) => b.weight - a.weight);
}

/** Exams and quizzes in the week starting `weekOf` (a Monday), as fixed calendar events. */
export function examEvents(assignments: Assignment[], weekOf: string): WeekEvent[] {
  const [y, m, d] = weekOf.split("-").map(Number);
  const monday = new Date(y, m - 1, d).getTime();
  return assignments
    .filter((a) => (a.kind === "exam" || a.kind === "quiz") && a.time != null)
    .flatMap((a) => {
      const [ay, am, ad] = a.date.split("-").map(Number);
      const offset = Math.round((new Date(ay, am - 1, ad).getTime() - monday) / DAY_MS);
      if (offset < 0 || offset > 6) return [];
      const day: Day = DAYS[offset];
      return [{
        id: `exam-${a.id}`, title: `${shortCourse(a.courseCode)} ${a.title}`, day,
        start: a.time!, end: Math.min(1439, a.time! + 90), kind: "exam" as const, fixed: true,
      }];
    });
}

/** Monday of the week containing `d`, as YYYY-MM-DD (local time). */
export function mondayOf(d = new Date()): string {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}
