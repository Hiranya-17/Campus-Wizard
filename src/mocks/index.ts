// Example responses for each contract in src/lib/types.ts.
// Screens can build against these before the real API routes are done.
// Food numbers are placeholders until D's real dataset lands in data/food.json.

import type { FoodQuote, SemesterPlanResponse, WeekPlanResponse } from "@/lib/types";

export const mockSemesterPlan: SemesterPlanResponse = {
  term: "Spring 2027",
  totalUnits: 16,
  courses: [
    {
      code: "ENG EC 311",
      title: "Introduction to Logic Design",
      units: 4,
      reason: "Sophomore 2 on the CE sheet; you have sophomore standing",
      sections: [
        {
          term: "Spring 2027", section: "A1", instructor: "Densmore", location: "PHO 203",
          schedule: { raw: "MW 12:20 pm-2:05 pm", days: ["Mon", "Wed"], start: 740, end: 845 }, notes: "",
        },
        {
          term: "Spring 2027", section: "C1", instructor: "Densmore", location: "PHO 115",
          schedule: { raw: "M 10:10 am-11:55 am", days: ["Mon"], start: 610, end: 715 }, notes: "Lab",
        },
      ],
    },
    {
      code: "CAS MA 226",
      title: "Differential Equations",
      units: 4,
      reason: "Sophomore 2 on the CE sheet; MA 225 done",
      sections: [
        {
          term: "Spring 2027", section: "A1", instructor: "Staff", location: "CAS 522",
          schedule: { raw: "TR 9:30 am-10:45 am", days: ["Tue", "Thu"], start: 570, end: 645 }, notes: "",
        },
      ],
    },
    {
      code: "ENG EK 301",
      title: "Engineering Mechanics 1",
      units: 4,
      reason: "Sophomore 2 on the CE sheet; PY 211 done",
      sections: [
        {
          term: "Spring 2027", section: "A1", instructor: "Staff", location: "PHO 206",
          schedule: { raw: "TR 12:30 pm-1:45 pm", days: ["Tue", "Thu"], start: 750, end: 825 }, notes: "",
        },
      ],
    },
    {
      code: "ENG EC 330",
      title: "Applied Algorithms for Engineers",
      units: 4,
      reason: "Sophomore 2 on the CE sheet; EC 327 done",
      sections: [
        {
          term: "Spring 2027", section: "A1", instructor: "Staff", location: "PHO 210",
          schedule: { raw: "MWF 10:10 am-11:00 am", days: ["Mon", "Wed", "Fri"], start: 610, end: 660 }, notes: "",
        },
      ],
    },
  ],
  blocked: [{ code: "ENG EC 413", title: "Computer Organization", missing: ["ENG EC 311"] }],
  warnings: [],
};

export const mockWeekPlan: WeekPlanResponse = {
  weekOf: "2026-10-26",
  unscheduled: [],
  events: [
    { id: "c1", title: "EC 311 Lab", day: "Mon", start: 610, end: 715, kind: "class", location: "PHO 115", fixed: true },
    { id: "c2", title: "EC 311", day: "Mon", start: 740, end: 845, kind: "class", location: "PHO 203", fixed: true },
    { id: "s1", title: "Study: EC 311", day: "Mon", start: 900, end: 1020, kind: "study" },
    { id: "g1", title: "Gym (FitRec)", day: "Mon", start: 1050, end: 1110, kind: "gym", location: "FitRec" },
    { id: "k1", title: "BU Robotics Club", day: "Tue", start: 1140, end: 1230, kind: "club", location: "PHO 117", fixed: true },
    { id: "t1", title: "Call parents", day: "Sun", start: 1080, end: 1110, kind: "task" },
    { id: "z1", title: "Sleep", day: "Mon", start: 1380, end: 1440, kind: "sleep" },
  ],
};

export const sampleFood: FoodQuote[] = [
  { restaurant: "SAMPLE Pizza Place", app: "DoorDash", items: "Large cheese pizza", subtotal: 18, deliveryFee: 2.99, serviceFee: 2.7, smallOrderFee: 0, tax: 1.26, total: 24.95, etaMinutes: 30, acceptsConveniencePoints: false, checkedAt: "2026-10-24T12:00:00Z" },
  { restaurant: "SAMPLE Pizza Place", app: "Uber Eats", items: "Large cheese pizza", subtotal: 18.5, deliveryFee: 1.49, serviceFee: 2.78, smallOrderFee: 0, tax: 1.29, total: 24.06, etaMinutes: 35, acceptsConveniencePoints: false, checkedAt: "2026-10-24T12:00:00Z" },
  { restaurant: "SAMPLE Pizza Place", app: "Grubhub", items: "Large cheese pizza", subtotal: 18, deliveryFee: 3.49, serviceFee: 2.25, smallOrderFee: 0, tax: 1.26, total: 25, etaMinutes: 40, acceptsConveniencePoints: true, checkedAt: "2026-10-24T12:00:00Z" },
];
