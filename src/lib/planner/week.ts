import type { Day, EventKind, PlannedCourse, WeekEvent, WeekPlanRequest, WeekPlanResponse } from "@/lib/types";
import { DAYS } from "@/lib/types";

const GRID = 15; // place things on 15-minute marks
const BUFFER = 10; // walking time kept free around events

/** Turn chosen course sections into fixed weekly class events. */
export function classEvents(courses: PlannedCourse[]): WeekEvent[] {
  const out: WeekEvent[] = [];
  for (const c of courses) {
    for (const s of c.sections) {
      const { days, start, end } = s.schedule;
      if (start == null || end == null) continue;
      for (const day of days) {
        out.push({
          id: `${c.code}-${s.section}-${day}`.replace(/\s+/g, ""),
          title: `${c.code.split(" ").slice(1).join(" ")} ${s.section}`,
          day, start, end, kind: "class", location: s.location, fixed: true,
        });
      }
    }
  }
  return out;
}

export function planWeek(req: WeekPlanRequest): WeekPlanResponse {
  const { prefs } = req;
  const events: WeekEvent[] = [...req.fixed];
  const unscheduled: string[] = [];
  let n = 0;
  const bed = Math.min(1440, prefs.wakeTime + 1440 - Math.round(prefs.sleepHours * 60));

  const free = (day: Day, start: number, end: number) =>
    events.every((e) => e.day !== day || end + BUFFER <= e.start || start >= e.end + BUFFER);

  const place = (day: Day, len: number, from: number, to: number, title: string, kind: EventKind): boolean => {
    const lo = Math.max(from, prefs.wakeTime);
    const hi = Math.min(to, bed);
    for (let t = Math.ceil(lo / GRID) * GRID; t + len <= hi; t += GRID) {
      if (free(day, t, t + len)) {
        events.push({ id: `${kind}-${++n}`, title, day, start: t, end: t + len, kind });
        return true;
      }
    }
    return false;
  };

  const busyMinutes = (day: Day) =>
    events.filter((e) => e.day === day).reduce((sum, e) => sum + (e.end - e.start), 0);

  // Meals first: they anchor the day.
  for (const day of DAYS) {
    if (!place(day, 45, 660, 930, "Lunch", "meal")) unscheduled.push(`Lunch ${day}`);
    if (!place(day, 45, 1050, 1230, "Dinner", "meal")) unscheduled.push(`Dinner ${day}`);
  }

  // Gym on the days with the most free time; mornings, then late afternoon.
  const gymDays = [...DAYS].sort((a, b) => busyMinutes(a) - busyMinutes(b)).slice(0, prefs.gymDaysPerWeek);
  for (const day of DAYS.filter((d) => gymDays.includes(d))) {
    const ok =
      place(day, prefs.gymMinutes, prefs.wakeTime + 30, 600, "Gym (FitRec)", "gym") ||
      place(day, prefs.gymMinutes, 960, 1290, "Gym (FitRec)", "gym") ||
      place(day, prefs.gymMinutes, 600, 960, "Gym (FitRec)", "gym");
    if (!ok) unscheduled.push(`Gym ${day}`);
  }

  // Study blocks of up to 90 minutes, rotating through the week's classes.
  const subjects = [...new Set(req.fixed.filter((e) => e.kind === "class").map((e) => e.title.split(" ").slice(0, 2).join(" ")))];
  let s = 0;
  for (const day of DAYS) {
    const weekend = day === "Sat" || day === "Sun";
    let left = Math.round(prefs.studyHoursPerDay * 60 * (weekend ? 0.5 : 1));
    while (left >= 30) {
      const len = Math.min(90, left);
      const subject = subjects.length ? subjects[s++ % subjects.length] : "";
      if (!place(day, len, 540, bed - 30, `Study${subject ? `: ${subject}` : ""}`, "study")) {
        unscheduled.push(`${Math.round(left / 6) / 10}h study ${day}`);
        break;
      }
      left -= len;
    }
  }

  // Weekly tasks spread across the week, evenings first.
  const spread: Day[] = ["Sun", "Wed", "Fri", "Tue", "Sat", "Mon", "Thu"];
  for (const task of prefs.tasks) {
    for (let i = 0; i < task.timesPerWeek; i++) {
      const day = spread[(i * Math.max(1, Math.floor(7 / task.timesPerWeek))) % 7];
      const ok = place(day, task.minutes, 1080, bed, task.name, "task") || place(day, task.minutes, prefs.wakeTime, bed, task.name, "task");
      if (!ok) unscheduled.push(`${task.name} (${day})`);
    }
  }

  for (const day of DAYS) {
    if (bed < 1440) events.push({ id: `sleep-${day}`, title: "Sleep", day, start: bed, end: 1440, kind: "sleep" });
  }

  events.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start - b.start);
  return { weekOf: req.weekOf, events, unscheduled };
}
