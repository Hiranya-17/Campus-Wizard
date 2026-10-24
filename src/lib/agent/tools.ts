import "server-only";
import { getCourses, getFood, getMajor, listMajors } from "@/lib/data";
import { compareFood } from "@/lib/food";
import { missingGroups, planSemester } from "@/lib/planner/semester";
import { classEvents, planWeek } from "@/lib/planner/week";
import { summarize } from "@/lib/budget";
import { DEFAULT_BUDGET, DEFAULT_PREFS } from "@/lib/demo";
import { fmtTime } from "@/lib/format";
import { planRoute } from "@/lib/transit";
import type { Category, ChatCard, Day, Expense, Profile, SemesterPlanResponse, WeekPrefs } from "@/lib/types";
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
    name: "plan_semester",
    description: "Suggest next semester's courses from the student's major sheet, completed courses and standing, with conflict-free sections. Uses the saved profile for anything not given.",
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

export async function runTool(name: string, args: Args, profile: Profile): Promise<ToolResult> {
  const courses = getCourses();
  switch (name) {
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
