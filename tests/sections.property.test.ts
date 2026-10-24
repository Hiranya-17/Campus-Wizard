import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Section } from "@/lib/types";
import { pickSections, sectionOptions, sectionsOverlap, units } from "@/lib/sections";
import { arbCourseSections, arbSectionRow } from "./gen/sections";
import { coursesWithSections } from "./config/courses";

const RUNS = { numRuns: 200 };

// pickSections returns whole *units* (all rows sharing a section id), and a unit
// is one atomic pick. Rows within the same unit may list overlapping times (e.g.
// CS 111's two meeting rows, or scrape duplicates like CAS IN 299's repeated A1
// rows), which is not a scheduling clash. So "conflict" means an overlap between
// rows with *different* section ids. This mirrors pickSections's real contract.
const clash = (x: Section, y: Section) => x.section !== y.section && sectionsOverlap(x, y);
const overlapAny = (a: Section[], b: Section[]) => a.some((x) => b.some((y) => clash(x, y)));

function noInternalOverlap(result: Section[]): boolean {
  for (let i = 0; i < result.length; i++)
    for (let j = i + 1; j < result.length; j++) if (clash(result[i], result[j])) return false;
  return true;
}

// A small "busy" set to use as non-empty `taken`.
const busy: Section[] = [
  {
    term: "Fall 2026",
    section: "X1",
    instructor: "",
    location: "",
    schedule: { raw: "", days: ["Mon", "Wed"], start: 600, end: 660 },
    notes: "",
  },
];

describe("Property 1: pickSections is conflict-free", () => {
  it("generated: result (if any) has no internal overlap and no overlap with taken", () => {
    fc.assert(
      fc.property(arbCourseSections, fc.boolean(), (sections, useBusy) => {
        const taken = useBusy ? busy : [];
        const r = pickSections(sections, taken);
        if (r === null) return true; // no feasible conflict-free pick is valid
        return noInternalOverlap(r) && !overlapAny(r, taken);
      }),
      RUNS,
    );
  });

  it("real data: holds for every course with sections, empty and non-empty taken", () => {
    for (const c of coursesWithSections()) {
      for (const taken of [[], busy] as Section[][]) {
        const r = pickSections(c.sections, taken);
        if (r === null) continue;
        expect(noInternalOverlap(r), `internal overlap in ${c.code}`).toBe(true);
        expect(overlapAny(r, taken), `overlaps taken in ${c.code}`).toBe(false);
      }
    }
  });
});

describe("Property 2: companion-group shape", () => {
  const check = (sections: Section[]) =>
    sectionOptions(sections).every((opt) => {
      const labels = opt.companions.map((g) => g.label);
      const disc = labels.filter((l) => l === "Discussion").length;
      const lab = labels.filter((l) => l === "Lab").length;
      const nonEmpty = opt.companions.every((g) => g.choices.length >= 1);
      return disc <= 1 && lab <= 1 && nonEmpty;
    });

  it("generated", () => {
    fc.assert(fc.property(arbCourseSections, (s) => check(s)), RUNS);
  });

  it("real data", () => {
    for (const c of coursesWithSections()) expect(check(c.sections), c.code).toBe(true);
  });
});

describe("Property 3: unit identity (ids partition the input)", () => {
  const check = (sections: Section[]) => {
    const us = units(sections);
    // each unit shares one id
    for (const u of us) if (!u.every((s) => s.section === u[0].section)) return false;
    // ids partition the input: each input id in exactly one unit, all rows accounted for
    const unitIds = us.map((u) => u[0].section);
    if (new Set(unitIds).size !== unitIds.length) return false;
    const inputIds = new Set(sections.map((s) => s.section));
    if (new Set(unitIds).size !== inputIds.size) return false;
    const rowCount = us.reduce((n, u) => n + u.length, 0);
    return rowCount === sections.length;
  };

  it("generated", () => {
    fc.assert(fc.property(arbCourseSections, (s) => check(s)), RUNS);
  });

  it("real data", () => {
    for (const c of coursesWithSections()) expect(check(c.sections), c.code).toBe(true);
  });
});

describe("Property 4: option coverage (every id appears in some option)", () => {
  const idsOf = (sections: Section[]) => new Set(sections.map((s) => s.section));
  const coveredIds = (sections: Section[]) => {
    const ids = new Set<string>();
    for (const opt of sectionOptions(sections)) {
      for (const s of opt.primary) ids.add(s.section);
      for (const g of opt.companions) for (const u of g.choices) for (const s of u) ids.add(s.section);
    }
    return ids;
  };
  const check = (sections: Section[]) => {
    const input = idsOf(sections);
    const covered = coveredIds(sections);
    for (const id of input) if (!covered.has(id)) return false;
    return true;
  };

  it("generated", () => {
    fc.assert(fc.property(arbCourseSections, (s) => check(s)), RUNS);
  });

  it("real data", () => {
    for (const c of coursesWithSections()) expect(check(c.sections), c.code).toBe(true);
  });
});

describe("Property 5: sectionsOverlap symmetry and null-safety", () => {
  it("generated: symmetric; false when either side has null start/end", () => {
    fc.assert(
      fc.property(arbSectionRow("P1", "lecture"), arbSectionRow("Q1", "discussion"), (a, b) => {
        const sym = sectionsOverlap(a, b) === sectionsOverlap(b, a);
        const nulled: Section = { ...a, schedule: { ...a.schedule, start: null, end: null } };
        return sym && sectionsOverlap(nulled, b) === false && sectionsOverlap(b, nulled) === false;
      }),
      RUNS,
    );
  });
});
