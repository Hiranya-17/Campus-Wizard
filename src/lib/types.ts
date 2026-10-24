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
  /** Weekly to-dos: "Gym", 60 min, 3 times a week; "Call parents", 30 min, once a week. */
  tasks: { name: string; minutes: number; timesPerWeek: number }[];
  /** @deprecated older profiles only; turned into a "Gym" task by the planner */
  gymDaysPerWeek?: number;
  /** @deprecated older profiles only */
  gymMinutes?: number;
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
  /** Study emphasis from upcoming exams/deadlines: subject like "MA 226" -> weight; more weight, more study blocks. */
  focus?: { subject: string; weight: number; label: string }[];
}

// ---------- syllabus: exams and homework (POST /api/syllabus) ----------

export type AssignmentKind = "exam" | "quiz" | "homework" | "project" | "paper";

export interface Assignment {
  id: string;
  courseCode: string; // "CAS MA 226"
  title: string; // "Midterm 2", "HW 6"
  kind: AssignmentKind;
  date: string; // "2026-11-05"
  time: Minutes | null; // exam start or due time; null = end of day
  weight: number | null; // % of the final grade, if the syllabus says
  topics: string[]; // what it covers
  source: "syllabus" | "manual";
}

export interface SyllabusRequest {
  courseCode: string;
  text?: string;
  pdfBase64?: string;
}

export interface SyllabusResponse {
  courseCode: string;
  items: Assignment[];
  engine: "gemini" | "rules";
  note?: string;
}

/** One line of "what to study" advice. */
export interface StudyPriority {
  assignment: Assignment;
  daysLeft: number;
  score: number;
  suggestedHours: number;
  advice: string; // "Review: Laplace transforms, systems of ODEs"
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

// ---------- POST /api/extract-events ----------

export interface ExtractRequest {
  kind: "email" | "syllabus";
  text?: string; // email body or pasted syllabus
  pdfBase64?: string; // uploaded syllabus PDF
  source?: string; // "BU Robotics Club newsletter", "EC 311 syllabus"
}

export interface ExtractedEvent {
  title: string;
  date: string | null; // "2026-11-03"; null for a weekly meeting
  weekday: Day | null; // for recurring meetings
  start: Minutes | null;
  end: Minutes | null;
  location: string | null;
  kind: "club" | "exam" | "deadline" | "class";
  source: string;
}

export interface ExtractResponse {
  events: ExtractedEvent[];
  engine: "gemini" | "rules";
}

// ---------- dining halls (data/dining.json, GET /api/dining) ----------

/** A meal period's open/close for one weekday, minutes after midnight. null = closed that day. */
export interface DiningHours {
  day: Day;
  /** Named service periods, e.g. "Breakfast" 420–660. Empty array = closed. */
  periods: { name: string; start: Minutes; end: Minutes }[];
}

export interface DiningMenuItem {
  name: string;
  station: string; // "Grill", "Vegan", "Halal", "Comfort"
  cuisine: string; // "American", "Italian", "Indian", "Mexican", "Asian", "Mediterranean", "Vegan", "Breakfast"
  tags: string[]; // "vegan", "vegetarian", "halal", "gluten-free"
  meals: ("breakfast" | "lunch" | "dinner")[]; // which periods serve it
}

export interface DiningHall {
  id: string; // "west"
  name: string; // "The Fresh Food Co. at West Campus"
  building: string; // building code in data/buildings.json when known, else ""
  address: string;
  campus: "West" | "Central" | "East" | "Fenway";
  style: string; // "All-you-care-to-eat", "Kosher"
  payWith: string[]; // "Dining Plan Meals", "Convenience Points", "Dining Points", "Credit Cards", "Cash"
  cuisines: string[]; // cuisines regularly available
  features: string[]; // "Full Vegan Station", "Halal Options", "Gluten-Free Kitchen"
  hours: DiningHours[];
  /** Menu rotates by weekday; the API returns today's slice as `today`. */
  menu: { day: Day; items: DiningMenuItem[] }[];
  url: string;
}

/** One hall with today's computed status and menu, as returned by GET /api/dining. */
export interface DiningHallToday {
  hall: Omit<DiningHall, "menu" | "hours">;
  hours: { name: string; start: Minutes; end: Minutes }[];
  openNow: boolean;
  /** The service period open right now, or the next one today, or null. */
  currentPeriod: string | null;
  items: DiningMenuItem[]; // today's menu
}

export interface DiningRecommendation {
  hallId: string;
  hallName: string;
  items: string[]; // dishes to try there today
  why: string; // one short sentence
}

// POST /api/dining/recommend  { cuisine, meal?, tags?, when? }
export interface DiningRecommendRequest {
  cuisine: string; // free text: "something spicy", "italian", "comfort food"
  meal?: "breakfast" | "lunch" | "dinner";
  tags?: string[]; // dietary filters: "vegan", "halal", "gluten-free"
}

export interface DiningRecommendResponse {
  recommendations: DiningRecommendation[];
  engine: "gemini" | "rules";
}

// ---------- food comparison ----------

export interface FoodComparison {
  restaurant: string;
  items: string;
  quotes: FoodQuote[]; // cheapest first
  cheapest: DeliveryApp;
  savings: number; // dollars saved vs the most expensive app
  conveniencePointsApps: DeliveryApp[];
}

// ---------- budget ----------

export const CATEGORIES = ["food", "transport", "textbooks", "entertainment", "daily"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  id: string;
  date: string; // "2026-10-24"
  amount: number; // dollars
  merchant: string;
  category: Category;
  paidWith: "card" | "dining points" | "convenience points" | "cash";
  source: "manual" | "receipt" | "email" | "food-compare" | "chat";
  note?: string;
}

export interface Budget {
  semesterStart: string; // "2026-09-02"
  semesterEnd: string; // "2026-12-19"
  limits: Record<Category, number>; // dollars for the whole semester
}

// POST /api/expenses/extract  { text?, imageBase64?, mimeType? } -> { expenses: Expense[], engine }
export interface ExpenseExtractRequest {
  text?: string;
  imageBase64?: string;
  mimeType?: string; // "image/jpeg"
  pdfBase64?: string; // a receipt or a bank/card statement as PDF
}

// ---------- the single demo user (kept in the browser, sent with each chat) ----------

export interface Profile {
  name?: string;
  majorId: string; // "ce"
  standing: "freshman" | "sophomore" | "junior" | "senior";
  term: string; // term being planned, "Fall 2026"
  completed: string[]; // courses finished BEFORE the term being planned
  prefs?: WeekPrefs;
  clubs?: WeekEvent[]; // club meetings, from Gmail or typed in
  assignments?: Assignment[]; // exams and homework from uploaded syllabi
  semester?: SemesterPlanResponse; // the student's chosen classes and sections for `term`
  home?: string; // building code where the day starts, e.g. "WARREN"
  expenses?: Expense[];
  budget?: Budget;
}

// ---------- POST /api/chat ----------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  profile?: Profile;
}

/** Structured results the chat screen can render as cards under the reply. */
export type ChatCard =
  | { kind: "semester"; data: SemesterPlanResponse } // a suggestion: shown with "Use this schedule"
  | { kind: "schedule"; data: SemesterPlanResponse } // Rhett changed the student's schedule: applied right away
  | { kind: "week"; data: WeekPlanResponse }
  | { kind: "food"; data: FoodComparison[] }
  | { kind: "course"; data: Course }
  | { kind: "expense"; data: Expense } // the chat screen saves these to the profile
  | { kind: "budget"; data: BudgetSummary };

export interface BudgetSummary {
  daysElapsed: number;
  daysTotal: number;
  categories: { category: Category; spent: number; limit: number; projected: number }[];
  total: { spent: number; limit: number; projected: number };
}

export interface ChatResponse {
  reply: string;
  cards?: ChatCard[];
  /** "gemini" when the AI model answered, "rules" for the no-key fallback. */
  engine: "gemini" | "rules";
}
