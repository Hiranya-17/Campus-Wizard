# Design — T2: Property-based tests for sections.ts and schedule.ts

## Overview

Add Vitest as the test runner and fast-check for property-based testing, then
write property tests that assert the invariants of `src/lib/sections.ts` and
`src/lib/schedule.ts` against (a) randomly generated section data and (b) real
entries from `data/courses.json`.

Design priorities, in order:
1. Don't break the pre-push gate. `npx tsc --noEmit`, `npx eslint src`, and
   `npm run build` must keep passing. Test files live outside `src/` so Next's
   build and the `eslint src` scope never see them.
2. Match the app's module resolution. Vitest must resolve the `@/*` -> `./src/*`
   alias exactly as TypeScript/Next does (tsconfig `paths` maps `@/*` to `./src/*`).
3. Meaningful properties. Generators produce the real BU section shapes
   (multi-day lectures, discussion/lab pools spanning letters); real-data tests
   cover every course that has sections.

## Architecture

Two layers sit beside the existing source, never inside it:

- Test tooling — Vitest (runner + assertions) and fast-check (property
  generators), added as pinned devDependencies, plus a `vitest.config.ts` at the
  repo root and a `test` script in `package.json`.
- Test suite — a top-level `tests/` directory holding generators, a real-data
  harness, and two property-test files.

```
tests/
  config/courses.ts           real-data loader (coursesWithSections())
  gen/sections.ts             fast-check arbitraries for Section[] in the five BU shapes
  sections.property.test.ts
  schedule.property.test.ts
vitest.config.ts
```

A top-level `tests/` dir (not `src/__tests__`) keeps tests out of `eslint src`
and `next build`, so they can't break the pre-push gate or ship in the bundle.

### Module resolution
`vitest.config.ts` sets `resolve.alias` to `{ "@": path.resolve(__dirname, "src") }`
so `@/lib/sections` resolves exactly as it does under tsconfig `paths`
(`@/* -> ./src/*`). `test.environment` is `node`; `test.include` is
`tests/**/*.test.ts`; no globals (import `describe/it/expect` from `vitest`).

### Keeping the build green (R1.5)
- No source file imports from `tests/`, so the build graph is unchanged.
- `tsconfig` globs `**/*.ts`, so `tsc --noEmit` type-checks the tests too
  (desirable). If a Vitest/fast-check type ever conflicts with Next's strict
  settings, the fallback is a dedicated tsconfig include for `tests` rather than
  loosening the root config. Default expectation: no tsconfig change needed.
- `eslint src` does not scan `tests/`.

## Components and Interfaces

### Dependencies (devDependencies, pinned exact versions)
- `vitest` (2.x) — runner + assertions (`describe`/`it`/`expect`).
- `fast-check` (3.x) — property generators and `fc.assert`/`fc.property`.
- No `@vitejs/plugin-react`: these are pure TS unit tests, no JSX.

### package.json
- Add script `"test": "vitest --run"` (single-run, non-watch, non-zero exit on failure).
- Add the two devDependencies.

### Generators — tests/gen/sections.ts
fast-check arbitraries emitting `Section[]` shaped like real BU courses. Times
are minutes-after-midnight; days drawn from `DAYS`.

Building blocks:
- `arbMeeting`: `{ days, start, end }`, `start` in 480..1140,
  `end = start + {50|75|110|170}`, `days` a non-empty weekday subset.
- `arbSectionRow(id, kind)`: a `Section` with given id + meeting; `kind` biases
  duration/day-count (lecture = 2-3 days; discussion ~50 min/1 day; lab
  ~110-170 min/1 day).

Course-shape arbitraries (each returns `Section[]`):
- `arbStandalonePool` (WR 153): N ids, each a single full-class row.
- `arbLectureOwnedDiscussions` (MA 226): A1 + A2..A6, optional B1 + B2..B5.
- `arbLectureSharedLabs` (EC 311): A1 + labs C1..Ck (letter has no lecture).
- `arbLetterSpanningPools` (PY 212): discussions D1..D9,E1..,F1 and labs
  L1..,M1..,N1 — pools crossing letters.
- `arbMultiTimeUnit` (CS 111): one section id on two rows at different times.

`arbCourseSections = fc.oneof(...)` over the above, plus an array combiner that
concatenates shapes. Generators intentionally allow overlapping times so
conflict logic is exercised (R7.1). They are a model of BU structure, not a
re-derivation of `sections.ts`, so they can't tautologically pass.

### Real-data harness — tests/config/courses.ts
- `loadCourses(): Course[]` — `JSON.parse` of `data/courses.json` (root-relative),
  typed as `Course[]` from `@/lib/types`, memoized at module scope (~8 MB).
- `coursesWithSections(): Course[]` — `sections.length > 0`.
- Coverage properties (R2.3, R3.3, R4.3, R7.2) iterate this array directly
  (loop / `it.each`), not sampling, so coverage is complete and deterministic.
  fast-check drives the generated side; real data is exhaustive iteration.

### Units under test
- From `@/lib/sections`: `units`, `sectionOptions`, `pickSections`, `sectionsOverlap`.
- From `@/lib/schedule`: `withCourse`, `withoutCourse`, `conflicts`, `emptySchedule`.

## Data Models

Reuses the existing contracts in `src/lib/types.ts`; no new persisted shapes.
Relevant types:

- `Section` — `{ term, section, instructor, location, schedule: { raw, days, start, end }, notes }`,
  with `start`/`end` as `Minutes | null`. The unit of generation and the input to
  `sectionOptions`/`pickSections`.
- `Course` — source of real-data sections (`course.sections`).
- `PlannedCourse` — `{ code, title, units: number, reason, sections: Section[] }`;
  the element type `conflicts`/`withCourse`/`withoutCourse` operate on.
- `SemesterPlanResponse` (aliased `Schedule` in `schedule.ts`) —
  `{ term, courses, totalUnits, blocked, warnings }`.

Test-only helper shapes:
- `arbPlannedCourse` — generates a `PlannedCourse` with a unique `code`, `units`
  in 0..6, and a `sections` array (from generators or a real course's
  `pickSections` output).

## Correctness Properties

Properties P1–P5 live in `sections.property.test.ts`; P6–P10 in
`schedule.property.test.ts`. Each generated property runs via
`fc.assert(fc.property(...), { numRuns: 200 })`; each real-data property iterates
every course with sections. In-test helpers: `overlapAny(a,b)` (via
`sectionsOverlap`) and id extraction.

### Property 1: pickSections is conflict-free (R2.1, R2.2, R2.4)

**Validates: Requirements 2.1, 2.2, 2.4**
For `taken` in `{ [], busySet }`, `r = pickSections(course, taken)`; if non-null,
no pair in `r` overlaps and no `r x taken` overlap. `null` passes.

### Property 2: companion-group shape (R3.1, R3.2)

**Validates: Requirements 3.1, 3.2**
Per option, at most one "Discussion" and at most one "Lab" group; every group has
`choices.length >= 1`.

### Property 3: unit identity (R4.1)

**Validates: Requirements 4.1**
Each unit's rows share one section id; ids partition the input.

### Property 4: option coverage (R4.2)

**Validates: Requirements 4.2**
The ids across all options (primary + companions) equal the input id set.

### Property 5: sectionsOverlap symmetry and null-safety (R6.3)

**Validates: Requirements 6.3**
`overlap(a,b) === overlap(b,a)`; false if either side has a null start or end.

### Property 6: add/drop round-trip (R5.1)

**Validates: Requirements 5.1**
For `c.code` not in `s`, `withoutCourse(withCourse(s,c), c.code)` has the same
course-code set as `s`.

### Property 7: totalUnits equals sum of units (R5.2)

**Validates: Requirements 5.2**
After any add/drop sequence, `totalUnits === sum(courses.units)`.

### Property 8: replace vs add (R5.3, R5.4)

**Validates: Requirements 5.3, 5.4**
Adding an existing code keeps the course count and swaps the object; adding a new
code increments the count by exactly one.

### Property 9: conflicts is symmetric (R6.1)

**Validates: Requirements 6.1**
`conflicts(courses)` as a set of unordered `{a,b}` code-pairs equals the result
with the courses and their sections reversed.

### Property 10: a clean build has no conflicts (R6.2)

**Validates: Requirements 6.2**
Fold an ordered list of real courses, choosing each via
`pickSections(course.sections, chosenSoFar)`, skipping `null`; the resulting
`PlannedCourse[]` has `conflicts(...) === []`.

## Error Handling

- Empty `sections`: `sectionOptions` -> `[]`, `pickSections` -> `null`,
  `units` -> `[]`; properties vacuously true.
- Null start/end: excluded from overlap; Property 5 asserts this.
- Real course with sections but no resolvable primary: `sectionOptions` may
  return `[]`. If Property 4 finds ids left uncovered, that's a real finding
  (R7.3) — investigate the source before weakening the property.
- Reproducibility (R7.4): no fixed global seed; fast-check randomizes per run and
  prints the failing seed + shrunk counterexample on failure. Real-data iteration
  is deterministic, so any real-data failure reproduces from the reported course code.

## Testing Strategy

This spec is the test work; the strategy is the two property suites above plus
the verification gate. Run in order; all must pass before commit/push:
1. `npx vitest --run`
2. `npx tsc --noEmit`
3. `npx eslint src`
4. `npm run build`
