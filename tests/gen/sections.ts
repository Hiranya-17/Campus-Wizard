import fc from "fast-check";
import type { Day, Section } from "@/lib/types";
import { DAYS } from "@/lib/types";

// Weekdays only (BU lectures/discussions/labs don't meet on weekends in practice,
// but generators may still produce any subset to stress the logic).
const WEEKDAYS: Day[] = ["Mon", "Tue", "Wed", "Fri", "Thu"];

type Kind = "lecture" | "discussion" | "lab";

/** A non-empty subset of weekdays, sized to the meeting kind. */
function arbDays(kind: Kind): fc.Arbitrary<Day[]> {
  const count = kind === "lecture" ? fc.integer({ min: 2, max: 3 }) : fc.constant(1);
  return count.chain((n) =>
    fc
      .shuffledSubarray(WEEKDAYS, { minLength: n, maxLength: n })
      // Keep canonical weekday order so `days` looks like the real data.
      .map((ds) => DAYS.filter((d) => ds.includes(d))),
  );
}

/** start/end in minutes-after-midnight; duration depends on kind. */
function arbMeeting(kind: Kind): fc.Arbitrary<{ days: Day[]; start: number; end: number }> {
  const duration =
    kind === "lecture"
      ? fc.constantFrom(50, 75, 90)
      : kind === "discussion"
        ? fc.constantFrom(50, 55)
        : fc.constantFrom(110, 170); // lab
  return fc.record({
    start: fc.integer({ min: 480, max: 1140 }), // 8:00 am .. 7:00 pm
    dur: duration,
    days: arbDays(kind),
  }).map(({ start, dur, days }) => ({ days, start, end: start + dur }));
}

/** One Section row with a given id and kind. */
export function arbSectionRow(id: string, kind: Kind): fc.Arbitrary<Section> {
  return arbMeeting(kind).map((m) => ({
    term: "Fall 2026",
    section: id,
    instructor: "Test, Instructor",
    location: "TST 101",
    schedule: { raw: `${m.days.join("")} ${m.start}-${m.end}`, days: m.days, start: m.start, end: m.end },
    notes: "",
  }));
}

// ---- The five BU course shapes (each returns Section[]) ----

/** WR 153: every section is a full standalone class; pick one. */
export const arbStandalonePool: fc.Arbitrary<Section[]> = fc
  .integer({ min: 1, max: 6 })
  .chain((n) =>
    fc.tuple(...Array.from({ length: n }, (_, i) => arbSectionRow(`${String.fromCharCode(69 + i)}1`, "lecture"))),
  )
  .map((rows) => rows);

/** MA 226: lecture A1 owns discussions A2..A6; optional lecture B1 owns B2..B5. */
export const arbLectureOwnedDiscussions: fc.Arbitrary<Section[]> = fc
  .record({
    aDisc: fc.integer({ min: 1, max: 5 }),
    hasB: fc.boolean(),
    bDisc: fc.integer({ min: 1, max: 4 }),
  })
  .chain(({ aDisc, hasB, bDisc }) => {
    const parts: fc.Arbitrary<Section>[] = [arbSectionRow("A1", "lecture")];
    for (let i = 0; i < aDisc; i++) parts.push(arbSectionRow(`A${i + 2}`, "discussion"));
    if (hasB) {
      parts.push(arbSectionRow("B1", "lecture"));
      for (let i = 0; i < bDisc; i++) parts.push(arbSectionRow(`B${i + 2}`, "discussion"));
    }
    return fc.tuple(...parts);
  })
  .map((rows) => rows);

/** EC 311: lecture A1 plus shared labs C1..Ck (C has no lecture). */
export const arbLectureSharedLabs: fc.Arbitrary<Section[]> = fc
  .integer({ min: 1, max: 5 })
  .chain((labs) => {
    const parts: fc.Arbitrary<Section>[] = [arbSectionRow("A1", "lecture")];
    for (let i = 0; i < labs; i++) parts.push(arbSectionRow(`C${i + 1}`, "lab"));
    return fc.tuple(...parts);
  })
  .map((rows) => rows);

/** PY 212: discussion pool spanning D/E/F and lab pool spanning L/M/N. */
export const arbLetterSpanningPools: fc.Arbitrary<Section[]> = fc
  .record({
    disc: fc.integer({ min: 1, max: 12 }),
    lab: fc.integer({ min: 1, max: 12 }),
  })
  .chain(({ disc, lab }) => {
    const parts: fc.Arbitrary<Section>[] = [arbSectionRow("A1", "lecture")];
    const discLetters = ["D", "E", "F"];
    const labLetters = ["L", "M", "N"];
    for (let i = 0; i < disc; i++) {
      const letter = discLetters[Math.floor(i / 9)] ?? "F";
      parts.push(arbSectionRow(`${letter}${(i % 9) + 1}`, "discussion"));
    }
    for (let i = 0; i < lab; i++) {
      const letter = labLetters[Math.floor(i / 9)] ?? "N";
      parts.push(arbSectionRow(`${letter}${(i % 9) + 1}`, "lab"));
    }
    return fc.tuple(...parts);
  })
  .map((rows) => rows);

/** CS 111: a single section id meets at two different times (one unit, two rows). */
export const arbMultiTimeUnit: fc.Arbitrary<Section[]> = fc
  .tuple(arbSectionRow("A1", "lecture"), arbSectionRow("A1", "discussion"))
  .map(([a, b]) => [a, b]);

/** Any one of the five shapes (clean: every row distinct, every row timed). */
export const arbCleanCourseSections: fc.Arbitrary<Section[]> = fc.oneof(
  arbStandalonePool,
  arbLectureOwnedDiscussions,
  arbLectureSharedLabs,
  arbLetterSpanningPools,
  arbMultiTimeUnit,
);

/** A row with no parsed meeting time, like the ~3,600 "TBA"/irregular rows in the real data. */
export const tbaRow = (id: string): Section => ({
  term: "Fall 2026",
  section: id,
  instructor: "Staff",
  location: "",
  schedule: { raw: "", days: [], start: null, end: null },
  notes: "",
});

/**
 * What the scraper really produces: some rows repeated verbatim (BU lists e.g. CAS IN 299 A1 five times)
 * and some rows with no time, either as extra rows of an existing section or as their own section.
 */
export function messy(sections: Section[]): fc.Arbitrary<Section[]> {
  return fc
    .record({
      dupes: fc.array(fc.nat({ max: Math.max(0, sections.length - 1) }), { maxLength: 3 }),
      tbaOnExisting: fc.option(fc.nat({ max: Math.max(0, sections.length - 1) }), { nil: undefined }),
      tbaSection: fc.boolean(),
      shuffle: fc.boolean(),
    })
    .map(({ dupes, tbaOnExisting, tbaSection, shuffle }) => {
      const out = [...sections];
      for (const i of dupes) if (sections[i]) out.push({ ...sections[i], schedule: { ...sections[i].schedule } });
      if (tbaOnExisting !== undefined && sections[tbaOnExisting]) out.push(tbaRow(sections[tbaOnExisting].section));
      if (tbaSection) out.push(tbaRow("X9"));
      return shuffle ? out.reverse() : out;
    });
}

/** The shapes above with real-data mess mixed in. All properties run against this. */
export const arbCourseSections: fc.Arbitrary<Section[]> = arbCleanCourseSections.chain(messy);
