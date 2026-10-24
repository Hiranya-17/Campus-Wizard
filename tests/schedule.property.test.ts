import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { PlannedCourse, Section } from "@/lib/types";
import { conflicts, emptySchedule, withCourse, withoutCourse } from "@/lib/schedule";
import { pickSections } from "@/lib/sections";
import { arbCourseSections } from "./gen/sections";
import { coursesWithSections } from "./config/courses";

const RUNS = { numRuns: 200 };

const arbPlannedCourse: fc.Arbitrary<PlannedCourse> = fc
  .record({
    code: fc.string({ minLength: 2, maxLength: 6 }).map((s) => `DEP ${s}`),
    units: fc.integer({ min: 0, max: 6 }),
    sections: arbCourseSections,
  })
  .map(({ code, units, sections }) => ({ code, title: code, units, reason: "", sections }));

// A list of PlannedCourses with distinct codes.
const arbDistinctCourses = fc
  .array(arbPlannedCourse, { maxLength: 6 })
  .map((cs) => {
    const seen = new Set<string>();
    return cs.filter((c) => (seen.has(c.code) ? false : (seen.add(c.code), true)));
  });

const codes = (cs: PlannedCourse[]) => new Set(cs.map((c) => c.code));
const sumUnits = (cs: PlannedCourse[]) => cs.reduce((n, c) => n + c.units, 0);

describe("Property 6: add/drop round-trip restores the course-code set", () => {
  it("generated", () => {
    fc.assert(
      fc.property(arbDistinctCourses, arbPlannedCourse, (existing, c) => {
        let s = emptySchedule("Fall 2026");
        for (const e of existing) if (e.code !== c.code) s = withCourse(s, e);
        const before = codes(s.courses);
        const after = codes(withoutCourse(withCourse(s, c), c.code).courses);
        return before.size === after.size && [...before].every((x) => after.has(x));
      }),
      RUNS,
    );
  });
});

describe("Property 7: totalUnits equals the sum of course units", () => {
  it("generated: holds after any add/drop sequence", () => {
    fc.assert(
      fc.property(arbDistinctCourses, fc.array(fc.string(), { maxLength: 4 }), (adds, drops) => {
        let s = emptySchedule("Fall 2026");
        for (const c of adds) s = withCourse(s, c);
        for (const d of drops) s = withoutCourse(s, d);
        return s.totalUnits === sumUnits(s.courses);
      }),
      RUNS,
    );
  });
});

describe("Property 8: replace vs add", () => {
  it("generated: existing code replaces (count unchanged); new code increments by one", () => {
    fc.assert(
      fc.property(arbDistinctCourses, arbPlannedCourse, (existing, c) => {
        let s = emptySchedule("Fall 2026");
        for (const e of existing) if (e.code !== c.code) s = withCourse(s, e);
        const n = s.courses.length;

        const added = withCourse(s, c);
        if (added.courses.length !== n + 1) return false; // new code -> +1
        if (!added.courses.some((x) => x.code === c.code)) return false;

        const replacement: PlannedCourse = { ...c, units: c.units === 6 ? 0 : 6, title: "replaced" };
        const replaced = withCourse(added, replacement);
        if (replaced.courses.length !== n + 1) return false; // existing code -> count unchanged
        const got = replaced.courses.find((x) => x.code === c.code);
        return got?.title === "replaced";
      }),
      RUNS,
    );
  });
});

describe("Property 9: conflicts is symmetric", () => {
  const pairKey = (a: string, b: string) => [a, b].sort().join("::");
  const conflictSet = (cs: PlannedCourse[]) => new Set(conflicts(cs).map((k) => pairKey(k.a, k.b)));

  it("generated: reversing courses and their sections yields the same pair set", () => {
    fc.assert(
      fc.property(arbDistinctCourses, (cs) => {
        const forward = conflictSet(cs);
        const reversed = [...cs].reverse().map((c) => ({ ...c, sections: [...c.sections].reverse() }));
        const back = conflictSet(reversed);
        return forward.size === back.size && [...forward].every((k) => back.has(k));
      }),
      RUNS,
    );
  });
});

describe("Property 10: a clean course-by-course build has no conflicts", () => {
  it("real data: fold real courses choosing sections via pickSections, skipping null", () => {
    const pool = coursesWithSections().slice(0, 400); // bounded for runtime; still a broad real sample
    const built: PlannedCourse[] = [];
    const chosen: Section[] = [];
    for (const c of pool) {
      const picked = pickSections(c.sections, chosen);
      if (picked === null) continue;
      built.push({ code: c.code, title: c.title, units: Number(c.units ?? 0) || 0, reason: "", sections: picked });
      chosen.push(...picked);
      if (built.length >= 12) break; // a realistic full schedule size
    }
    expect(conflicts(built)).toEqual([]);
  });
});
