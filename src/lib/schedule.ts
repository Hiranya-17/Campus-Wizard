import { sectionsOverlap } from "@/lib/sections";
import type { PlannedCourse, Section, SemesterPlanResponse } from "@/lib/types";

/** The student's picked classes for a term, stored in the SemesterPlanResponse shape. */
export type Schedule = SemesterPlanResponse;

export const emptySchedule = (term: string): Schedule => ({ term, courses: [], totalUnits: 0, blocked: [], warnings: [] });

const total = (courses: PlannedCourse[]) => courses.reduce((u, c) => u + c.units, 0);

/** Add a course, or replace its sections if it's already in the schedule. */
export function withCourse(s: Schedule, course: PlannedCourse): Schedule {
  const courses = s.courses.some((c) => c.code === course.code)
    ? s.courses.map((c) => (c.code === course.code ? course : c))
    : [...s.courses, course];
  return { ...s, courses, totalUnits: total(courses), blocked: [], warnings: [] };
}

export function withoutCourse(s: Schedule, code: string): Schedule {
  const courses = s.courses.filter((c) => c.code !== code);
  return { ...s, courses, totalUnits: total(courses) };
}

export interface Conflict {
  a: string; // course code
  b: string;
  aSection: Section;
  bSection: Section;
}

export function conflicts(courses: PlannedCourse[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < courses.length; i++)
    for (let j = i + 1; j < courses.length; j++)
      for (const x of courses[i].sections)
        for (const y of courses[j].sections)
          if (sectionsOverlap(x, y)) out.push({ a: courses[i].code, b: courses[j].code, aSection: x, bSection: y });
  return out;
}

/** Courses in `courses` (other than `except`) that any of `sections` overlaps. */
export function clashesWith(sections: Section[], courses: PlannedCourse[], except?: string): string[] {
  return courses
    .filter((c) => c.code !== except && c.sections.some((x) => sections.some((y) => sectionsOverlap(x, y))))
    .map((c) => c.code);
}

export const shortCode = (code: string) => code.split(" ").slice(1).join(" ");
