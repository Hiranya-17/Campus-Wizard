import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Course, FoodQuote, Major } from "@/lib/types";
import { sampleFood } from "@/mocks";

const DATA = path.join(process.cwd(), "data");

let courses: Map<string, Course> | null = null;

export function getCourses(): Map<string, Course> {
  if (!courses) {
    const file = path.join(DATA, "courses.json");
    const list: Course[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
    courses = new Map(list.map((c) => [c.code, c]));
  }
  return courses;
}

export function getMajor(id: string): Major | null {
  const file = path.join(DATA, "majors", `${id}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

export function listMajors(): { id: string; name: string }[] {
  const dir = path.join(DATA, "majors");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const m: Major = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      return { id: m.id, name: m.name };
    });
}

export function getFood(): FoodQuote[] {
  const file = path.join(DATA, "food.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : sampleFood;
}
