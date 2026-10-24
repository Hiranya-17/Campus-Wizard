# Implementation Plan

## Overview

Add a reusable major-validation script, then the two Kiro agent hooks that use
it and the type/lint checks. Build the script first so the validation hook has
something to call; verify against the shipped majors and crafted broken inputs.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4"] },
    { "wave": 4, "tasks": ["5"] }
  ],
  "dependencies": {
    "1": [],
    "2": ["1"],
    "3": ["2"],
    "4": [],
    "5": ["3", "4"]
  }
}
```

- Wave 1: Task 1 writes the validator script.
- Wave 2: Task 2 verifies the script against real and broken majors.
- Wave 3: Task 3 (validation hook, needs the script) and Task 4 (type/lint hook,
  independent) can run together.
- Wave 4: Task 5 runs the full verification gate.

## Tasks

- [x] 1. Write scripts/validate-majors.mjs
  - CLI entrypoint: no args validates all `data/majors/*.json`; file args validate
    only those files
  - Load `data/courses.json` into a code `Set`; validate course slots, elective
    slot group ids, and `electiveGroups[].courses`
  - Report `{file, where, message}` errors clearly; exit non-zero on any error,
    zero when clean; handle bad JSON / missing files without throwing
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2. Verify the validator
  - Run with no args; confirm all six shipped majors pass and it exits zero
  - Craft a temp broken major for each failure mode (missing course code, unknown
    elective group, bad course in a group); confirm each is reported and exits
    non-zero; delete the temp file
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Add validate-major-on-change hook
  - Create `.kiro/hooks/validate-major-on-change.kiro.hook` triggering on
    `data/majors/*.json` changes and running the validator on the changed file,
    reporting results
  - _Requirements: 2.1, 2.5, 2.6_

- [x] 4. Add typecheck-lint-on-save hook
  - Create `.kiro/hooks/typecheck-lint-on-save.kiro.hook` triggering on save of
    `src/**/*.ts(x)` and running `npx tsc --noEmit` and `npx eslint src`,
    reporting failures and never modifying files
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5. Run the verification gate
  - Confirm `npx tsc --noEmit`, `npx eslint src`, `npm run build` all pass with
    the new script and hooks present
  - _Requirements: 3.6_

## Notes

- The validator is plain `.mjs` (no TypeScript, no `@/` alias, no Next) so the
  hook has no build dependency and runs fast at save/change time.
- Hooks never commit or push; they only run checks and report, keeping the
  live-deploy safety rule intact.
