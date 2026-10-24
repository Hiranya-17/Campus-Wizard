import "server-only";
import { getCourses, getFood, getMajor, listMajors } from "@/lib/data";
import { compareFood } from "@/lib/food";
import { missingGroups, planSemester, unitsOf } from "@/lib/planner/semester";
import { clashesWith, conflicts, emptySchedule, withCourse, withoutCourse, type Schedule } from "@/lib/schedule";
import { pickSections, sectionOptions } from "@/lib/sections";
import { classEvents, planWeek } from "@/lib/planner/week";
import { summarize } from "@/lib/budget";
import { DEFAULT_BUDGET, DEFAULT_PREFS } from "@/lib/demo";
import { fmtTime } from "@/lib/format";
import { planRoute } from "@/lib/transit";
import type { Category, ChatCard, Day, Expense, Profile, Section, SemesterPlanResponse, WeekPrefs } from "@/lib/types";
import { DAYS } from "@/lib/types";

/** Monday of next week as YYYY-MM-DD. */
export function nextMonday(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

type Args = Record<string, unknown>;
export type ToolResult = { result: unknown; card?: ChatCard };

/** Tool declarations in JSON Schema form (used by the AI model). */
export const TOOL_DECLARATIONS = [
  {
    name: "search_courses",
    description: "Search BU courses by code or title words. Returns up to 10 matches.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "get_course",
    description: "Full details for one BU course: description, prerequisites, Hub areas, section times. Also says whether the student meets the prerequisites.",
    parameters: { type: "object", properties: { code: { type: "string", description: 'Like "ENG EC 311"' } }, required: ["code"] },
  },
  {
    name: "list_sections",
    description: "All sections of a course for the student's term: lecture/standalone options with their discussions or labs, days, times, rooms, instructors, and which of the student's current classes each one clashes with. Use to answer 'is there a morning section of WR 153?' before adding.",
    parameters: { type: "object", properties: { code: { type: "string", description: 'Like "CAS WR 153" or "WR 153"' } }, required: ["code"] },
  },
  {
    name: "add_course",
    description: "Add a course to the student's schedule (or change its sections if it's already there). Give section ids to choose specific ones, e.g. ['A1','C3']; leave them out to take the first set that doesn't clash with the current schedule. The calendar updates immediately.",
    parameters: {
      type: "object",
      properties: { code: { type: "string" }, sections: { type: "array", items: { type: "string" } } },
      required: ["code"],
    },
  },
  {
    name: "remove_course",
    description: "Remove a course from the student's schedule.",
    parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
  },
  {
    name: "check_schedule",
    description: "The student's current schedule for the term: courses, sections, total units, time clashes, and missing prerequisites.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "plan_semester",
    description: "Suggest a full schedule for the term from the student's major sheet, courses taken before this term and standing, with conflict-free sections. The student sees it with a 'Use this as my schedule' button. Uses the saved profile for anything not given.",
    parameters: {
      type: "object",
      properties: {
        majorId: { type: "string" },
        term: { type: "string", description: 'Like "Spring 2027"' },
        standing: { type: "string", enum: ["freshman", "sophomore", "junior", "senior"] },
        completed: { type: "array", items: { type: "string" } },
        maxUnits: { type: "number" },
      },
    },
  },
  {
    name: "plan_week",
    description: "Build next week's schedule around the student's classes and clubs, fitting sleep, meals, study, gym and weekly tasks. Ask the student about their preferences first if they haven't said.",
    parameters: {
      type: "object",
      properties: {
        sleepHours: { type: "number" },
        wakeTime: { type: "string", description: 'Like "7:30 am"' },
        studyHoursPerDay: { type: "number" },
        gymDaysPerWeek: { type: "number" },
        gymMinutes: { type: "number" },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, minutes: { type: "number" }, timesPerWeek: { type: "number" } },
            required: ["name", "minutes", "timesPerWeek"],
          },
        },
      },
    },
  },
  {
    name: "compare_food",
    description: "Compare the total cost (subtotal + fees + tax) of the same order across DoorDash, Uber Eats and Grubhub for restaurants near BU. Leave restaurant empty to list all.",
    parameters: { type: "object", properties: { restaurant: { type: "string" } } },
  },
  {
    name: "route_day",
    description: "When to leave for each class and how to get there (walk or Green Line, with live MBTA trains and the weather) for today or a given weekday, starting from where the student lives.",
    parameters: {
      type: "object",
      properties: {
        day: { type: "string", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], description: "Defaults to today" },
        from: { type: "string", description: "Building code to start from, e.g. WARREN, WEST, STUVI, MYLES" },
      },
    },
  },
  {
    name: "budget_summary",
    description: "The student's spending this semester by category (food, transport, textbooks, entertainment, daily) versus their budget, and the projected total by the end of the semester at the current pace.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "log_expense",
    description: "Record a purchase in the student's budget, e.g. when they say they spent money.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number" },
        merchant: { type: "string" },
        category: { type: "string", enum: ["food", "transport", "textbooks", "entertainment", "daily"] },
        paidWith: { type: "string", enum: ["card", "dining points", "convenience points", "cash"] },
      },
      required: ["amount", "merchant", "category"],
    },
  },
  {
    name: "list_majors",
    description: "Majors Rhett has program planning sheets for.",
    parameters: { type: "object", properties: {} },
  },
];

function parseTime(s: unknown): number | undefined {
  if (typeof s !== "string") return undefined;
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return undefined;
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h !== 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + Number(m[2] ?? 0);
}

/** "wr 153" or "CAS WR 153" -> the catalog code. */
function resolveCode(raw: unknown, courses: Map<string, { code: string }>): string | null {
  const q = String(raw ?? "").toUpperCase().replace(/\s+/g, "");
  if (!q) return null;
  for (const c of courses.keys()) if (c.replace(/\s+/g, "") === q) return c;
  for (const c of courses.keys()) if (c.replace(/\s+/g, "").endsWith(q)) return c;
  return null;
}

export async function runTool(name: string, args: Args, profile: Profile): Promise<ToolResult> {
  const courses = getCourses();
  const schedule: Schedule = profile.semester?.term === profile.term ? profile.semester : emptySchedule(profile.term);
  switch (name) {
    case "list_sections": {
      const code = resolveCode(args.code, courses);
      const c = code ? courses.get(code) : undefined;
      if (!c) return { result: { error: `No course ${args.code}` } };
      const opts = sectionOptions(c.sections.filter((s) => s.term === profile.term));
      const describe = (u: Section[]) => ({
        section: u[0].section,
        meets: u.map((s) => `${s.schedule.raw || "TBA"} in ${s.location || "TBA"}`),
        instructor: u[0].instructor,
        clashesWith: clashesWith(u, schedule.courses, c.code),
      });
      return {
        result: {
          code: c.code, title: c.title, term: profile.term,
          missingPrereqs: missingGroups(c.prereqs, new Set(profile.completed)).map((g) => g.join(" or ")),
          options: opts.map((o) => ({ ...describe(o.primary), mustAlsoPickOneOf: o.companions.map((g) => ({ kind: g.label, choices: g.choices.map(describe) })) })),
        },
        card: { kind: "course", data: c },
      };
    }
    case "add_course": {
      const code = resolveCode(args.code, courses);
      const c = code ? courses.get(code) : undefined;
      if (!c) return { result: { error: `No course ${args.code}` } };
      const termSections = c.sections.filter((s) => s.term === profile.term);
      const others = schedule.courses.filter((x) => x.code !== c.code).flatMap((x) => x.sections);
      let picked: Section[] | null;
      const ids = (args.sections as string[] | undefined)?.map((x) => x.toUpperCase());
      if (ids?.length) {
        picked = termSections.filter((s) => ids.includes(s.section.toUpperCase()));
        if (!picked.length) return { result: { error: `No sections ${ids.join(", ")} for ${c.code} in ${profile.term}` } };
      } else {
        picked = termSections.length ? pickSections(termSections, others) : [];
        if (!picked) return { result: { error: `Every ${c.code} section clashes with your current classes. Remove or move one first.` } };
      }
      const next = withCourse(schedule, { code: c.code, title: c.title, units: unitsOf(c), reason: "Added by Rhett", sections: picked });
      return {
        result: {
          added: c.code,
          sections: picked.map((s) => `${s.section} ${s.schedule.raw} ${s.location} (${s.instructor})`),
          clashesWith: clashesWith(picked, next.courses, c.code),
          missingPrereqs: missingGroups(c.prereqs, new Set(profile.completed)).map((g) => g.join(" or ")),
          totalUnits: next.totalUnits,
        },
        card: { kind: "schedule", data: next },
      };
    }
    case "remove_course": {
      const code = resolveCode(args.code, courses);
      if (!code || !schedule.courses.some((x) => x.code === code)) return { result: { error: `${args.code} isn't in your schedule` } };
      const next = withoutCourse(schedule, code);
      return { result: { removed: code, totalUnits: next.totalUnits }, card: { kind: "schedule", data: next } };
    }
    case "check_schedule": {
      const have = new Set(profile.completed);
      return {
        result: {
          term: schedule.term,
          totalUnits: schedule.totalUnits,
          courses: schedule.courses.map((x) => ({
            code: x.code, title: x.title, units: x.units,
            sections: x.sections.map((s) => `${s.section} ${s.schedule.raw} ${s.location}`),
            missingPrereqs: missingGroups(courses.get(x.code)?.prereqs ?? [], have).map((g) => g.join(" or ")),
          })),
          clashes: conflicts(schedule.courses).map((k) => `${k.a} ${k.aSection.section} (${k.aSection.schedule.raw}) overlaps ${k.b} ${k.bSection.section} (${k.bSection.schedule.raw})`),
        },
      };
    }
    case "route_day": {
      const semester = profile.semester ?? ((await runTool("plan_semester", {}, profile)).card as { data: SemesterPlanResponse } | undefined)?.data;
      const todayIdx = (new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })).getDay() + 6) % 7;
      const day = (args.day as Day) ?? DAYS[todayIdx];
      const stops = [...classEvents(semester?.courses ?? []), ...(profile.clubs ?? [])]
        .filter((e) => e.day === day)
        .map((e) => ({ title: e.title, start: e.start, end: e.end, location: e.location }));
      if (!stops.length) return { result: { day, message: "No classes or club meetings that day." } };
      const nowBoston = new Date().toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false }).split(":").map(Number);
      const now = day === DAYS[todayIdx] ? nowBoston[0] * 60 + nowBoston[1] : 0;
      const { legs } = await planRoute(String(args.from ?? profile.home ?? "WARREN"), stops, now);
      return { result: { day, legs: legs.map((l) => ({ ...l, leaveBy: fmtTime(l.leaveBy), arriveBy: fmtTime(l.arriveBy), departs: l.transit ? fmtTime(l.transit.departs) : undefined })) } };
    }
    case "search_courses": {
      const q = String(args.query ?? "").toLowerCase();
      const hits = [];
      for (const c of courses.values()) {
        if (c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)) {
          hits.push({ code: c.code, title: c.title, units: c.units, prereqs: c.prereqText, hub: c.hub });
          if (hits.length >= 10) break;
        }
      }
      return { result: hits };
    }
    case "get_course": {
      const code = String(args.code ?? "").toUpperCase().replace(/\s+/g, " ").trim();
      const c = courses.get(code);
      if (!c) return { result: { error: `No course ${code}` } };
      const have = new Set(profile.completed);
      const missing = missingGroups(c.prereqs, have).map((g) => g.join(" or "));
      return {
        result: {
          ...c,
          description: c.description.slice(0, 500),
          sections: c.sections.slice(0, 8),
          studentMeetsPrereqs: missing.length === 0,
          missingPrereqs: missing,
        },
        card: { kind: "course", data: c },
      };
    }
    case "plan_semester": {
      const majorId = String(args.majorId ?? profile.majorId);
      const major = getMajor(majorId);
      if (!major) return { result: { error: `No sheet for major ${majorId}`, available: listMajors() } };
      const plan = planSemester(
        {
          majorId,
          term: String(args.term ?? profile.term),
          standing: (args.standing as Profile["standing"]) ?? profile.standing,
          completed: (args.completed as string[]) ?? profile.completed,
          maxUnits: args.maxUnits as number | undefined,
        },
        major,
        courses,
      );
      return { result: plan, card: { kind: "semester", data: plan } };
    }
    case "plan_week": {
      const prefs: WeekPrefs = {
        ...DEFAULT_PREFS,
        ...profile.prefs,
        ...Object.fromEntries(Object.entries(args).filter(([, v]) => v != null)),
      } as WeekPrefs;
      prefs.wakeTime = parseTime(args.wakeTime) ?? profile.prefs?.wakeTime ?? DEFAULT_PREFS.wakeTime;
      const semester =
        profile.semester ??
        ((await runTool("plan_semester", {}, profile)).card as { data: SemesterPlanResponse } | undefined)?.data;
      const fixed = [...classEvents(semester?.courses ?? []), ...(profile.clubs ?? [])];
      const plan = planWeek({ weekOf: nextMonday(), fixed, prefs });
      const summary = {
        weekOf: plan.weekOf,
        classes: fixed.length,
        counts: plan.events.reduce<Record<string, number>>((m, e) => ({ ...m, [e.kind]: (m[e.kind] ?? 0) + 1 }), {}),
        unscheduled: plan.unscheduled,
      };
      return { result: summary, card: { kind: "week", data: plan } };
    }
    case "compare_food": {
      const data = compareFood(getFood(), args.restaurant ? String(args.restaurant) : undefined);
      return { result: data, card: { kind: "food", data } };
    }
    case "budget_summary": {
      const summary = summarize(profile.expenses ?? [], profile.budget ?? DEFAULT_BUDGET);
      return { result: summary, card: { kind: "budget", data: summary } };
    }
    case "log_expense": {
      const expense: Expense = {
        id: `c${Date.now().toString(36)}`,
        date: new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
        amount: Math.round(Number(args.amount) * 100) / 100,
        merchant: String(args.merchant ?? "Purchase"),
        category: (args.category as Category) ?? "daily",
        paidWith: (args.paidWith as Expense["paidWith"]) ?? "card",
        source: "chat",
      };
      return { result: { logged: expense }, card: { kind: "expense", data: expense } };
    }
    case "list_majors":
      return { result: listMajors() };
    default:
      return { result: { error: `Unknown tool ${name}` } };
  }
}
