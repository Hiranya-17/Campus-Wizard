import type { Profile, WeekPrefs } from "@/lib/types";

export const DEFAULT_PREFS: WeekPrefs = {
  sleepHours: 8,
  wakeTime: 450,
  studyHoursPerDay: 3,
  gymDaysPerWeek: 3,
  gymMinutes: 60,
  tasks: [{ name: "Call parents", minutes: 30, timesPerWeek: 1 }],
};

/** The single demo user: a CE sophomore who finished freshman year and sophomore fall. */
export const DEMO_PROFILE: Profile = {
  name: "Terrier",
  majorId: "ce",
  standing: "sophomore",
  term: "Spring 2027",
  completed: [
    "CAS MA 123", "CAS CH 131", "ENG EK 100", "ENG EK 125", "CAS WR 120",
    "CAS MA 124", "CAS PY 211", "ENG EK 131", "ENG EK 103", "CAS WR 150",
    "CAS MA 225", "CAS PY 212", "ENG EK 307", "ENG EC 327", "CAS MA 193",
  ],
  prefs: DEFAULT_PREFS,
  clubs: [
    { id: "club-robotics", title: "BU Robotics Club", day: "Tue", start: 1140, end: 1230, kind: "club", location: "PHO 117", fixed: true },
  ],
};
