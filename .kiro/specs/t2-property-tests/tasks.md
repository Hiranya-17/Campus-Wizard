# Implementation Plan

## Overview

Add Vitest + fast-check and write property tests for `src/lib/sections.ts` and
`src/lib/schedule.ts`, run against generated data and real `data/courses.json`
entries. Tooling and tests live in a top-level `tests/` dir so the pre-push gate
(`tsc`/`eslint src`/`build`) is unaffected. Work the tasks in order; each cites
the requirements it satisfies.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "3"] },
    { "wave": 3, "tasks": ["4", "5"] },
    { "wave": 4, "tasks": ["6"] }
  ],
  "dependencies": {
    "1": [],
    "2": ["1"],
    "3": ["1"],
    "4": ["2", "3"],
    "5": ["2", "3"],
    "6": ["4", "5"]
  }
}
```

- Wave 1: Task 1 (tooling) has no dependencies and must come first.
- Wave 2: Tasks 2 and 3 depend only on Task 1 and can run in either order.
- Wave 3: Tasks 4 and 5 depend on both 2 and 3.
- Wave 4: Task 6 (verification gate) depends on 4 and 5.

## Tasks

- [x] 1. Add test tooling (Vitest + fast-check) without breaking the build
  - Add `vitest` and `fast-check` as pinned devDependencies in `package.json`
  - Add a `"test": "vitest --run"` script (single-run, non-zero exit on failure)
  - Create `vitest.config.ts` at repo root: `test.include=tests/**/*.test.ts`,
    `test.environment="node"`, `resolve.alias` mapping `@` -> `./src`
  - Confirm `npx vitest --run` discovers zero tests and exits 0, and that
    `npx tsc --noEmit`, `npx eslint src`, `npm run build` still pass
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Build the real-data harness
  - Create `tests/config/courses.ts` with `loadCourses(): Course[]` that parses
    `data/courses.json` (root-relative) typed as `Course[]` from `@/lib/types`,
    memoized at module scope
  - Add `coursesWithSections(): Course[]` returning courses with `sections.length > 0`
  - _Requirements: 7.2_

- [x] 3. Build the section generators
  - Create `tests/gen/sections.ts` with `arbMeeting` and `arbSectionRow`
  - Implement the five course-shape arbitraries: `arbStandalonePool` (WR 153),
    `arbLectureOwnedDiscussions` (MA 226), `arbLectureSharedLabs` (EC 311),
    `arbLetterSpanningPools` (PY 212), `arbMultiTimeUnit` (CS 111)
  - Combine into `arbCourseSections`; allow overlapping times so conflict logic
    is exercised
  - _Requirements: 7.1_

- [x] 4. Write sections.property.test.ts (Properties 1-5)
  - [x] 4.1 Property 1 — `pickSections` conflict-free, over generated data and
    every course in `coursesWithSections()`, against empty and non-empty `taken`;
    treat `null` as a valid outcome
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 4.2 Property 2 — each `sectionOptions` option has <=1 Discussion and <=1
    Lab group, no empty required group
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 4.3 Property 3 — `units` groups by one id; ids partition the input
    - _Requirements: 4.1_
  - [x] 4.4 Property 4 — every input section id appears in some option
    - _Requirements: 4.2, 4.3_
  - [x] 4.5 Property 5 — `sectionsOverlap` symmetric and null-safe
    - _Requirements: 6.3_

- [x] 5. Write schedule.property.test.ts (Properties 6-10)
  - [x] 5.1 Property 6 — add/drop round-trip restores the course-code set
    - _Requirements: 5.1_
  - [x] 5.2 Property 7 — `totalUnits` equals the sum of course units after any
    add/drop sequence
    - _Requirements: 5.2_
  - [x] 5.3 Property 8 — `withCourse` replaces an existing code (count unchanged)
    and increments count by one for a new code
    - _Requirements: 5.3, 5.4_
  - [x] 5.4 Property 9 — `conflicts` is symmetric under reversal of courses and
    their sections
    - _Requirements: 6.1_
  - [x] 5.5 Property 10 — a schedule built course-by-course with `pickSections`
    yields `conflicts(...) === []`, using real `coursesWithSections()` data
    - _Requirements: 6.2, 7.2_

- [x] 6. Run the full verification gate and resolve findings
  - Run `npx vitest --run`; if a property fails on real data, investigate the
    source as a potential bug before weakening the property, and document any
    intentional exclusion with a reason in the test
  - Run `npx tsc --noEmit`, `npx eslint src`, `npm run build` and confirm all pass
  - _Requirements: 1.5, 7.3, 7.4_

## Notes

- `numRuns: 200` per generated property keeps the suite fast while sampling
  broadly; real-data properties iterate exhaustively, not by sampling.
- A real-data property failure is treated as a likely source bug and investigated
  before any property is weakened (per Requirement 7.3).
- Never push a failing build to `main` — the gate in Task 6 is mandatory before
  commit/push.
