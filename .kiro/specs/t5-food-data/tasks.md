# Implementation Plan

## Overview

Transcribe the collected delivery prices into `data/food.json` as `FoodQuote[]`
using the confirmed mapping, then validate shape/grouping/reconciliation and the
pre-push gate. No app code changes — `getFood()` already prefers the file.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] }
  ],
  "dependencies": {
    "1": [],
    "2": ["1"],
    "3": ["2"]
  }
}
```

- Wave 1: write the file.
- Wave 2: validate contents.
- Wave 3: run the verification gate.

## Tasks

- [x] 1. Write data/food.json
  - Transcribe the 8 restaurants x 3 apps = 24 quotes using the column mapping
  - Normalize "GrubHub" -> "Grubhub"; `etaMinutes` = integer midpoint of the range;
    `acceptsConveniencePoints` = false; one ISO `checkedAt` for all
  - Omit the empty Pho Le rows; correct Cafe Landwer / DoorDash `total` to 26.26
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2_

- [x] 2. Validate the file contents
  - Parse and assert: every `app` is a valid `DeliveryApp`; all numeric fields are
    numbers; no `restaurant` starts with `SAMPLE`; per restaurant the `restaurant`
    and `items` strings are consistent
  - Reconcile `total` vs. the fee sum; confirm the only >1-cent gaps are the
    documented promotions
  - _Requirements: 1.4, 3.3, 4.1, 4.2_

- [x] 3. Run the verification gate
  - `npx tsc --noEmit`, `npx eslint src`, `npm run build` all pass
  - Confirm `data/food.json` is not gitignored
  - _Requirements: 4.3, 4.4_

## Notes

- Printed `total` from the sheet is authoritative; promotions can make it lower
  than the fee sum (every Uber Eats row -0.98; Cafe Landwer DoorDash -6.75 from a
  column shift; Malatown Uber Eats -3.00).
- Manual check of the Money screen banner is left to the team (needs the dev
  server), but the data condition that hides it (no SAMPLE names) is verified here.
