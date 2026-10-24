// Shared data contracts. Screens, API routes and the agent all use these,
// so change them only after telling the team.

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Minutes after midnight, e.g. 9:05 am = 545. */
export type Minutes = number;

// ---------- courses (data/courses.json) ----------

export interface Section {
  term: string; // "Fall 2026" | "Spring 2027"
  section: string; // "A1" lecture, "B1"/"C1" discussion or lab
  instructor: string;
  location: string; // "PHO 203"
  schedule: { raw: string; days: Day[]; start: Minutes | null; end: Minutes | null };
  notes: string;
}

export interface Course {
  code: string; // "ENG EC 311"
  college: string;
  dept: string;
  number: string;
  title: string;
  url: string;
  units?: string;
  hub: string[]; // BU Hub areas this course fulfills
  description: string;
  prereqText: string;
  coreqText: string;
  /** AND of ORs: [["CAS MA 123"], ["ENG EK 125", "CAS CS 111"]] */
  prereqs: string[][];
  coreqs: string[][];
  recommended: string[];
  minStanding: "freshman" | "sophomore" | "junior" | "senior" | "graduate" | null;
  level: number | null; // 100, 200, ...
  sections: Section[];
}

// ---------- majors (data/majors/<id>.json) ----------

export type Slot =
  | { kind: "course"; code: string }
  | { kind: "elective"; group: string } // id of an ElectiveGroup
  | { kind: "hub" };

export interface Major {
  id: string; // "ce"
  name: string; // "Computer Engineering"
  school: string; // "ENG"
  classOf: string; // "2029"
  totalUnits: number;
  /** Recommended order from the program planning sheet. */
  plan: { term: string; slots: Slot[] }[];
  electiveGroups: { id: string; name: string; count: number; courses: string[]; rule?: string }[];
  hubRequired: string[];
  notes: string[];
}

// ---------- POST /api/plan/semester ----------

export interface SemesterPlanRequest {
  majorId: string;
  completed: string[]; // course codes already taken or in progress
  term: string; // "Spring 2027"
  standing: "freshman" | "sophomore" | "junior" | "senior";
  maxUnits?: number; // default 18
}

export interface PlannedCourse {
  code: string;
  title: string;
  units: number;
  reason: string; // "Next on the CE sheet; prereq EC 311 done"
  sections: Section[]; // chosen lecture + lab/discussion, conflict-free
}

export interface SemesterPlanResponse {
  term: string;
  courses: PlannedCourse[];
  totalUnits: number;
  /** Courses the sheet wants next but the student can't take yet. */
  blocked: { code: string; title: string; missing: string[] }[];
  warnings: string[];
}

// ---------- POST /api/plan/week ----------

export interface WeekPrefs {
  sleepHours: number; // 8
  wakeTime: Minutes; // 450 = 7:30 am
  studyHoursPerDay: number;
  gymDaysPerWeek: number;
  gymMinutes: number;
  /** Anything else weekly: "Call parents", 30 min, once a week. */
  tasks: { name: string; minutes: number; timesPerWeek: number }[];
}

export type EventKind = "class" | "club" | "exam" | "study" | "gym" | "sleep" | "meal" | "task" | "travel";

export interface WeekEvent {
  id: string;
  title: string;
  day: Day;
  start: Minutes;
  end: Minutes;
  kind: EventKind;
  location?: string;
  fixed?: boolean; // classes, clubs, exams can't be moved
}

export interface WeekPlanRequest {
  weekOf: string; // ISO date of the Monday, "2026-10-26"
  fixed: WeekEvent[]; // classes, club meetings, exams
  prefs: WeekPrefs;
}

export interface WeekPlanResponse {
  weekOf: string;
  events: WeekEvent[];
  unscheduled: string[]; // things that didn't fit
}

// ---------- data/food.json ----------

export type DeliveryApp = "DoorDash" | "Uber Eats" | "Grubhub";

export interface FoodQuote {
  restaurant: string;
  app: DeliveryApp;
  items: string;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  smallOrderFee: number;
  tax: number;
  total: number;
  etaMinutes: number;
  acceptsConveniencePoints: boolean;
  checkedAt: string; // ISO timestamp
}

// ---------- POST /api/chat ----------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
}
