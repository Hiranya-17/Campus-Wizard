# Requirements Document

_T2: Property-based tests for `sections.ts` and `schedule.ts`_

## Introduction

The scheduling core (`src/lib/sections.ts`, `src/lib/schedule.ts`) encodes the hard-won rules for how BU courses register (lecture/discussion/lab grouping, conflict-free picks) and the schedule data model (add/drop, unit totals, conflict detection). These are the most logic-dense and highest-risk modules in the app, and there are currently no automated tests.

This spec adds a test runner (Vitest) and property-based tests (fast-check) that assert the invariants these modules must always satisfy, checked against both randomly generated section data and real entries from `data/courses.json`. The goal is to lock in correct behavior so later Kiro changes can't silently regress it, and to produce evidence (property tests, and anything they catch) for the hackathon submission.

Scope is tests and the test tooling only. These tests must not require source changes to pass unless they surface a genuine bug; if a property fails against real data, we investigate before weakening the property.

## Requirements

### Requirement 1: Test tooling

**User Story:** As a developer on this repo, I want a fast, standard test runner with property-based testing, so I can assert invariants over many generated and real inputs and run them in CI and local hooks.

#### Acceptance Criteria
1. WHEN a developer runs `npx vitest --run` THEN the suite SHALL execute all property tests once (non-watch) and exit non-zero on any failure.
2. WHEN the test tooling is added THEN `package.json` SHALL include a `test` script that runs Vitest in single-run mode.
3. WHEN tests are added THEN they SHALL use `vitest` and `fast-check` as devDependencies, with versions compatible with the repo's TypeScript and Node 20 setup.
4. WHEN Vitest resolves imports THEN the `@/` path alias used by source files (`@/lib/...`) SHALL resolve the same way it does under Next/TypeScript.
5. WHEN the test tooling is added THEN running `npx tsc --noEmit`, `npx eslint src`, and `npm run build` SHALL all still pass (the test setup must not break the production build or the pre-push gate).

### Requirement 2: `pickSections` produces conflict-free picks

**User Story:** As a student adding a class, I want the auto-picked sections to never overlap each other or my existing classes, so my calendar has no clashes.

#### Acceptance Criteria
1. WHEN `pickSections(sections, taken)` returns a non-null result THEN no two sections in the result SHALL overlap each other.
2. WHEN `pickSections(sections, taken)` returns a non-null result THEN no section in the result SHALL overlap any section in `taken`.
3. WHEN these properties are evaluated THEN they SHALL hold for generated section sets AND for every course in `data/courses.json` that has sections, against an empty `taken` and against a non-empty `taken`.
4. WHEN `pickSections` returns `null` THEN the test SHALL treat that as a valid outcome (no feasible conflict-free pick), not a failure.

### Requirement 3: `sectionOptions` companion-group shape

**User Story:** As the scheduling engine, I want every option to require at most one discussion and one lab, so a student is never asked to pick more companions than BU actually requires.

#### Acceptance Criteria
1. WHEN `sectionOptions(sections)` returns options THEN each option SHALL have at most one companion group labeled "Discussion" and at most one labeled "Lab".
2. WHEN an option has companion groups THEN each group SHALL have at least one choice (no empty required group).
3. WHEN these properties are evaluated THEN they SHALL hold for generated section sets AND for every course in `data/courses.json` that has sections.

### Requirement 4: Unit identity and coverage

**User Story:** As the scheduling engine, I want each unit to correspond to exactly one section id and every section of a course to appear in some option, so no meeting time is silently dropped and co-located rows always travel together.

#### Acceptance Criteria
1. WHEN `units(sections)` groups sections THEN every unit SHALL contain only rows sharing a single section id, and each section id SHALL appear in exactly one unit.
2. WHEN `sectionOptions(sections)` returns options THEN every section id present in the input SHALL appear in some option (as the primary or within some companion group).
3. WHEN these properties are evaluated THEN they SHALL hold for generated section sets AND for every course in `data/courses.json` that has sections.

### Requirement 5: `schedule.ts` algebraic invariants

**User Story:** As a student managing my schedule, I want add/drop and unit totals to behave consistently, so the displayed unit count and course list are always correct.

#### Acceptance Criteria
1. WHEN `c` is not already in schedule `s` THEN `withoutCourse(withCourse(s, c), c.code)` SHALL contain the same set of course codes as `s`.
2. WHEN `withCourse` is applied THEN the resulting `totalUnits` SHALL equal the sum of the `units` of its courses; the same SHALL hold after `withoutCourse`.
3. WHEN `withCourse(s, c)` is called and a course with `c.code` already exists in `s` THEN the result SHALL replace that course (not duplicate it), and the course count SHALL be unchanged.
4. WHEN `withCourse` adds a brand-new course THEN the course count SHALL increase by exactly one.

### Requirement 6: `conflicts` correctness

**User Story:** As the calendar, I want conflict detection to be order-independent and to agree with `pickSections`, so clash warnings are consistent and a cleanly built schedule shows no false conflicts.

#### Acceptance Criteria
1. WHEN `conflicts(courses)` is computed THEN the result SHALL be symmetric: reversing the order of `courses` (and the order of sections within them) SHALL yield the same set of conflicting course-code pairs.
2. WHEN a schedule is built course by course using `pickSections` to choose each course's sections against the already-chosen sections THEN `conflicts` over the resulting `PlannedCourse[]` SHALL be empty.
3. WHEN `sectionsOverlap(a, b)` is evaluated THEN it SHALL be symmetric (`sectionsOverlap(a,b) === sectionsOverlap(b,a)`) and SHALL be false whenever either section has a null start or end.

### Requirement 7: Honest, reproducible tests

**User Story:** As a hackathon team that will be judged on testing, I want the property tests to be meaningful and reproducible, so they provide real evidence rather than passing trivially.

#### Acceptance Criteria
1. WHEN a property test runs THEN it SHALL exercise non-trivial inputs (generators SHALL be capable of producing multi-day lectures, overlapping times, and discussion/lab pools that span letters, mirroring WR 153 / MA 226 / EC 311 / PY 212 / CS 111 shapes).
2. WHEN the real-data properties run THEN they SHALL load actual `data/courses.json` and skip only courses with no sections, covering the remainder.
3. IF a property fails against real data THEN the failure SHALL be investigated as a potential bug in the source before the property is weakened, and any intentional exclusion SHALL be documented in the test with a reason.
4. WHEN property tests find a counterexample THEN the fast-check seed/shrink output SHALL be available in the test report for reproduction.

## Glossary

- **Unit:** every section row that shares one section id; co-located meeting times of the same section travel together as one pick.
- **Primary:** a lecture or standalone section — the unit a student must pick for a course (meets 2+ days/week or close to the longest weekly time).
- **Companion:** a discussion or lab unit that attaches to a primary; a course requires at most one discussion and at most one lab.
- **Option (`SectionOption`):** one primary plus its required companion groups, as returned by `sectionOptions`.
- **`taken`:** the sections already on the student's schedule, which a new pick must not overlap.
- **Property:** an invariant asserted over many inputs (generated or real) rather than a single hand-written example.
- **Generator / arbitrary:** a fast-check value source that produces random, shrinkable inputs for a property.
- **Pre-push gate:** `npx tsc --noEmit && npx eslint src && npm run build` — all three must pass before any push to `main`.
