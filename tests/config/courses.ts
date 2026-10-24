import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Course } from "@/lib/types";

// Resolve data/courses.json relative to the repo root (this file is tests/config/).
const coursesPath = fileURLToPath(new URL("../../data/courses.json", import.meta.url));

let cache: Course[] | null = null;

/** Parse data/courses.json once and memoize (the file is ~8 MB). */
export function loadCourses(): Course[] {
  if (cache === null) {
    cache = JSON.parse(readFileSync(coursesPath, "utf8")) as Course[];
  }
  return cache;
}

/** Courses that actually have section rows (the only ones worth testing). */
export function coursesWithSections(): Course[] {
  return loadCourses().filter((c) => c.sections.length > 0);
}
