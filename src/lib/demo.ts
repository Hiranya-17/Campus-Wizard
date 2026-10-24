import type { Budget, Expense, Profile, WeekPrefs } from "@/lib/types";

export const DEFAULT_PREFS: WeekPrefs = {
  sleepHours: 8,
  wakeTime: 450,
  studyHoursPerDay: 3,
  gymDaysPerWeek: 3,
  gymMinutes: 60,
  tasks: [{ name: "Call parents", minutes: 30, timesPerWeek: 1 }],
};

export const DEFAULT_BUDGET: Budget = {
  semesterStart: "2026-09-02",
  semesterEnd: "2026-12-19",
  limits: { food: 900, transport: 120, textbooks: 400, entertainment: 300, daily: 350 },
};

/** A few weeks of plausible spending so the budget screen isn't empty in the demo. */
const DEMO_EXPENSES: Expense[] = [
  { id: "d1", date: "2026-09-03", amount: 312.4, merchant: "Barnes & Noble at BU", category: "textbooks", paidWith: "card", source: "receipt" },
  { id: "d2", date: "2026-09-12", amount: 90, merchant: "MBTA semester pass (discounted)", category: "transport", paidWith: "card", source: "manual" },
  { id: "d3", date: "2026-09-20", amount: 41.2, merchant: "CVS Kenmore", category: "daily", paidWith: "card", source: "receipt" },
  { id: "d4", date: "2026-09-27", amount: 28.5, merchant: "AMC Boston Common", category: "entertainment", paidWith: "card", source: "email" },
  { id: "d5", date: "2026-10-02", amount: 24.95, merchant: "DoorDash: Pizza", category: "food", paidWith: "card", source: "email" },
  { id: "d6", date: "2026-10-05", amount: 13.4, merchant: "Chipotle Comm Ave", category: "food", paidWith: "card", source: "receipt" },
  { id: "d7", date: "2026-10-09", amount: 31.75, merchant: "Uber Eats: Sushi", category: "food", paidWith: "card", source: "email" },
  { id: "d8", date: "2026-10-13", amount: 9.8, merchant: "Pavement Coffeehouse", category: "food", paidWith: "convenience points", source: "manual" },
  { id: "d9", date: "2026-10-17", amount: 62, merchant: "Target Fenway", category: "daily", paidWith: "card", source: "receipt" },
  { id: "d10", date: "2026-10-19", amount: 45, merchant: "Red Sox tickets", category: "entertainment", paidWith: "card", source: "email" },
  { id: "d11", date: "2026-10-21", amount: 22.6, merchant: "Grubhub: Thai", category: "food", paidWith: "convenience points", source: "email" },
  { id: "d12", date: "2026-10-23", amount: 18.3, merchant: "Trader Joe's", category: "food", paidWith: "card", source: "receipt" },
];

/** The single demo user: a CE sophomore planning Fall 2026, with freshman year done. */
export const DEMO_PROFILE: Profile = {
  name: "Terrier",
  majorId: "ce",
  standing: "sophomore",
  term: "Fall 2026",
  completed: [
    "CAS MA 123", "CAS CH 131", "ENG EK 100", "ENG EK 125", "CAS WR 120",
    "CAS MA 124", "CAS PY 211", "ENG EK 131", "ENG EK 103", "CAS WR 150",
  ],
  prefs: DEFAULT_PREFS,
  home: "WARREN",
  budget: DEFAULT_BUDGET,
  expenses: DEMO_EXPENSES,
  clubs: [
    { id: "club-robotics", title: "BU Robotics Club", day: "Tue", start: 1140, end: 1230, kind: "club", location: "PHO 117", fixed: true },
  ],
};

/** A brand-new account: no demo courses, clubs or spending. */
export function starterProfile(p: Pick<Profile, "name" | "majorId" | "standing" | "home"> & { completed?: string[] }): Profile {
  return { term: "Fall 2026", completed: [], ...p, prefs: DEFAULT_PREFS, budget: DEFAULT_BUDGET, expenses: [], clubs: [] };
}

/** Class standing from units completed (BU: 32 per year). */
export function standingFor(units: number): Profile["standing"] {
  return units < 32 ? "freshman" : units < 64 ? "sophomore" : units < 96 ? "junior" : "senior";
}
