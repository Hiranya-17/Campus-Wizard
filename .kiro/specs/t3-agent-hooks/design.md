# Design — T3: Agent hooks

## Overview

Add two Kiro agent hooks and one reusable validation script:

1. A source-save hook that runs `npx tsc --noEmit` and `npx eslint src` when any
   `src/**/*.ts(x)` file is saved.
2. A major-file hook that runs a validation script when a `data/majors/*.json`
   file changes, checking every referenced course code and elective group.

The validation logic lives in a standalone Node script so it works without the
Next build or a server, and can be run by hand or in CI as well as from the hook.

## Architecture

```
.kiro/hooks/
  typecheck-lint-on-save.kiro.hook     trigger: save src/**/*.ts(x)  -> tsc + eslint
  validate-major-on-change.kiro.hook   trigger: edit data/majors/*.json -> node scripts/validate-majors.mjs <file>
scripts/
  validate-majors.mjs                  pure-Node validator; CLI entrypoint shared by the hook and humans
```

- Hooks are JSON `*.kiro.hook` files committed under `.kiro/hooks/`.
- `scripts/` already exists (Python scrapers live there); a `.mjs` validator fits
  the same "developer tooling, not app code" role and stays out of the Next build.
- Neither hook modifies source or pushes; they only run checks and report.

## Components and Interfaces

### Hook: typecheck-lint-on-save
- Trigger: file save matching `src/**/*.ts` and `src/**/*.tsx`.
- Action: an agent prompt instructing the agent to run `npx tsc --noEmit` and
  `npx eslint src` and report failures; it must not edit files or commit.
- Rationale for running `eslint src` (whole dir) rather than just the saved file:
  the repo's lint config is wired to the `src` scope, and a cross-file rule can
  only be judged across the tree. Runs are fast enough for save-time.

### Hook: validate-major-on-change
- Trigger: file change matching `data/majors/*.json`.
- Action: run `node scripts/validate-majors.mjs <changed-file>` and report the
  result; on failure, surface the offending file/slot/code.

### Script: scripts/validate-majors.mjs
- CLI: `node scripts/validate-majors.mjs [file ...]`.
  - No args: validate every `data/majors/*.json`.
  - With args: validate only the given files (the hook passes the changed file).
- Reads `data/courses.json` once, builds a `Set` of valid course codes.
- For each major file: parse JSON, then check the rules in Data Models below.
- Severity split: a course code (slot or `electiveGroups[].courses`) absent from
  `courses.json` is a WARNING, because the scraped course set is known-incomplete
  (e.g. some `CAS CH/PY` codes and grad/cross-list codes aren't in it) — a missing
  code is usually a data gap, not a broken major. An undefined elective-group id,
  unknown slot kind, missing `plan`/`electiveGroups`, or invalid JSON is an ERROR.
- Output: human-readable lines (⚠ warnings, ✗ errors, ✓ clean); a summary; exit
  code 1 only when an ERROR is found; warnings alone exit 0.
- No TypeScript, no `@/` alias, no Next: a plain `.mjs` run by Node, so the hook
  has no build dependency. (It mirrors the `Major` type by shape, not by import.)

## Data Models

Validated against the `Major` contract from `src/lib/types.ts` (checked
structurally, since the script is plain JS):

- `Major.plan[].slots[]` is a `Slot`:
  - `{ kind: "course", code }` — `code` must be in the course-code set.
  - `{ kind: "elective", group }` — `group` must be an `id` in
    `Major.electiveGroups`.
  - `{ kind: "hub" }` — no reference to check.
- `Major.electiveGroups[]` — each `{ id, name, count, courses[] }`; every entry
  of `courses` must be in the course-code set.

Validation result (internal): a list of `{ file, where, message }` errors; empty
means valid.

## Correctness Properties

### Property 1: valid majors pass

**Validates: Requirements 2.6, 3.4**
Running the validator over the current, committed `data/majors/*.json` files
exits zero (no hard errors). The shipped majors do emit course-code warnings for
codes missing from the incomplete scrape; those are expected and non-fatal.

### Property 2: broken references are caught

**Validates: Requirements 2.2, 2.3, 2.4, 2.5**
Given a major with (b) an elective slot whose `group` is not a defined group id,
the validator reports it as an ERROR and exits non-zero. Cases (a) a
`{kind:"course"}` code and (c) an `electiveGroups[].courses` entry absent from
`data/courses.json` are reported as WARNINGS and do not, by themselves, cause a
non-zero exit.

### Property 3: argument scoping

**Validates: Requirements 3.2, 3.3**
With no args the validator checks every major file; with file args it checks only
those files.

## Error Handling

- Unparseable JSON or a missing file: report the file and a parse/not-found
  message, exit non-zero (don't throw an unhandled exception).
- Missing `data/courses.json`: fail fast with a clear message (the validator
  can't verify codes without it).
- A major missing `plan` or `electiveGroups`: treat as a structural error with a
  clear message rather than crashing.

## Testing Strategy

- Run `node scripts/validate-majors.mjs` with no args and confirm the six shipped
  majors validate clean (Property 1).
- Temporarily point the validator at a crafted broken major (in a temp file) to
  confirm each of the three failure modes is reported and exits non-zero
  (Property 2), then discard the temp file.
- Confirm arg scoping by passing a single file (Property 3).
- Confirm the pre-push gate still passes: `npx tsc --noEmit`, `npx eslint src`,
  `npm run build` (the `.mjs` script is outside the build graph).
