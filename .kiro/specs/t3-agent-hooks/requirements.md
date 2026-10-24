# Requirements Document

_T3: Agent hooks for type/lint checks and major-file validation_

## Introduction

Kiro agent hooks automate repetitive quality checks so regressions surface
immediately and the live demo stays safe. This spec adds two hooks:

1. On save of a TypeScript source file under `src/`, run the type check and
   linter so breakages are caught before they reach a commit or the pre-push gate.
2. On change to a major planning sheet under `data/majors/*.json`, validate the
   file against the `Major` contract — every referenced course code exists in
   `data/courses.json`, and every elective slot names a defined elective group —
   so a malformed major sheet can't silently break the semester planner.

Hooks and any supporting scripts live under `.kiro/` (committed) since Kiro
usage is a scored judging criterion. Hooks must not themselves modify source or
push anything; they report results to the developer.

## Glossary

- **Agent hook:** a Kiro automation defined by a `.kiro/hooks/*.kiro.hook` file
  that triggers on an editor/file event and runs a prompt or command.
- **Major sheet:** a `data/majors/<id>.json` file conforming to the `Major` type.
- **Elective group:** an entry in a major's `electiveGroups` with an `id` that
  `{kind:"elective", group}` slots reference.
- **Pre-push gate:** `npx tsc --noEmit && npx eslint src && npm run build`.
- **Warning vs error:** a missing course code is a WARNING (the scrape is incomplete, so it's likely a data gap, not a bad major); an undefined elective-group id is an ERROR (purely internal to the major file).

## Requirements

### Requirement 1: Type/lint hook on source save

**User Story:** As a developer, I want type and lint checks to run automatically when I save a TypeScript file in `src/`, so I catch errors immediately instead of at the pre-push gate.

#### Acceptance Criteria
1. WHEN a file matching `src/**/*.ts` or `src/**/*.tsx` is saved THEN the hook SHALL run `npx tsc --noEmit` and `npx eslint src`.
2. WHEN both checks pass THEN the hook SHALL report success without modifying any file.
3. WHEN either check fails THEN the hook SHALL surface the failing output to the developer.
4. WHEN the hook runs THEN it SHALL NOT commit, push, or otherwise alter source files.
5. WHEN the hook is defined THEN it SHALL be a committed `.kiro/hooks/*.kiro.hook` file (not gitignored).

### Requirement 2: Major-file validation hook

**User Story:** As a developer maintaining major sheets, I want a changed `data/majors/*.json` validated against the `Major` contract, so a bad reference can't silently break the semester planner.

#### Acceptance Criteria
1. WHEN a file matching `data/majors/*.json` is changed THEN the hook SHALL validate that file against the `Major` shape.
2. WHEN a `{kind:"course"}` slot references a code absent from `data/courses.json` THEN the hook SHALL report it as a WARNING (the scraped course set is known-incomplete) and SHALL NOT exit non-zero for that alone.
3. WHEN a `{kind:"elective", group}` slot names an `id` not present in that major's `electiveGroups` THEN the hook SHALL report it as an ERROR and exit non-zero (this is internal to the file and always fixable).
4. WHEN a code inside `electiveGroups[].courses` is absent from `data/courses.json` THEN the hook SHALL report it as a WARNING (same reason as 2), not an error.
5. WHEN validation finds an ERROR (undefined elective group id, unknown slot kind, missing arrays, or invalid JSON) THEN the hook SHALL report each offending file, slot/group, and code with a clear message, and exit non-zero; warnings alone exit zero.
6. WHEN the file is valid THEN the hook SHALL report success and exit zero.

### Requirement 3: Reusable validation script

**User Story:** As a developer, I want the major validation logic in a script I can also run by hand or in CI, so the hook and manual runs share one implementation.

#### Acceptance Criteria
1. WHEN the validation logic is implemented THEN it SHALL live in a committed script that can be run from the command line.
2. WHEN run with no arguments THEN the script SHALL validate every file in `data/majors/`.
3. WHEN run with one or more file-path arguments THEN the script SHALL validate only those files (so the hook can pass just the changed file).
4. WHEN the script finds any error THEN it SHALL exit non-zero; otherwise exit zero.
5. WHEN the script runs THEN it SHALL NOT depend on the Next build or a running server (it reads the JSON data directly).
6. WHEN the script is added THEN running `npx tsc --noEmit`, `npx eslint src`, and `npm run build` SHALL still pass.
