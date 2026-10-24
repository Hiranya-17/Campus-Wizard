# Design — T5: Import real delivery prices

## Overview

Transcribe Person D's hand-collected delivery prices into `data/food.json` as an
array of `FoodQuote` objects. No code changes are needed: `getFood()` in
`src/lib/data.ts` already returns `data/food.json` when it exists and falls back
to `sampleFood` otherwise, and the Money screen hides the sample banner once no
restaurant starts with `SAMPLE`.

## Architecture

- Output: `data/food.json` — a static JSON array committed to the repo.
- Consumer (unchanged): `getFood()` -> `/api/food` -> `compareFood()` in
  `src/lib/food.ts`, which groups by `restaurant`, sorts by `total`, and derives
  cheapest / savings / convenience-points apps.
- No importer script is needed for a one-time transcription of ~24 rows; the file
  is authored directly. (If the dataset grows, a converter can be added later.)

## Components and Interfaces

`FoodQuote` (from `src/lib/types.ts`), produced per source row:
`{ restaurant, app, items, subtotal, deliveryFee, serviceFee, smallOrderFee,
tax, total, etaMinutes, acceptsConveniencePoints, checkedAt }`.

## Data Models

### Column mapping (sheet -> FoodQuote)
- Restaurant Name -> `restaurant`
- App -> `app` ("GrubHub" normalized to "Grubhub"; "DoorDash"/"Uber Eats" as-is)
- Order Details -> `items`
- Item Subtotal -> `subtotal`
- Delivery Fee -> `deliveryFee`
- Service Fee -> `serviceFee`
- Tax -> `tax`
- Other fees (ex. bag fee) -> `smallOrderFee` (0 when blank)
- Total Before Tip -> `total`
- Delivery Time (mins) -> `etaMinutes` = integer midpoint of the range
- (no column) -> `acceptsConveniencePoints` = false for all
- (no column) -> `checkedAt` = the import date as one ISO timestamp for all

### Restaurants imported (8)
Chipotle, Sweetgreen, Clay Pot Cafe, Anna's Taqueria, McDonald's, Tori Japan,
Cafe Landwer, Malatown — three apps each = 24 quotes.

### Corrections and omissions (auditable per Requirement 3.3)
- Pho Le Restaurant (page 2): all values empty / "No / Verify" -> OMITTED.
- Cafe Landwer / DoorDash: source row is column-shifted; "Total Before Tip" cell
  reads 6.75, which is actually the promotion/discount. Corrected `total` = 26.26
  (subtotal 27, delivery 0.49, service 4.05, tax 1.42, bag fee 0.05).

### Total vs. sum reconciliation (Requirement 4.2)
Printed `total` is authoritative; several rows are lower than
`subtotal+deliveryFee+serviceFee+smallOrderFee+tax` because of promotions:
- Every Uber Eats row is -0.98 vs. the sum: Uber Eats applied a small promo that
  the printed total already nets out. Kept as printed.
- Cafe Landwer / DoorDash: -6.75 (the column-shift promo described above).
- Malatown / Uber Eats: -3.00 (promo; printed total 35.93 kept).
These are expected promotions, not transcription errors.

## Correctness Properties

### Property 1: valid shape and app values

**Validates: Requirements 1.1, 1.2, 2.1**
Every element of `data/food.json` parses as a `FoodQuote`; every `app` is one of
"DoorDash", "Uber Eats", "Grubhub"; all required numeric fields are numbers.

### Property 2: no sample rows

**Validates: Requirements 1.4, 4.1**
No `restaurant` starts with `SAMPLE`, so `getFood()` returns this file and the
Money banner is hidden.

### Property 3: grouping is consistent

**Validates: Requirements 1.3**
For each restaurant, all its quotes share one `restaurant` string and one `items`
string, so `compareFood` groups the three apps into a single comparison.

### Property 4: totals reconcile or are explained

**Validates: Requirements 4.2**
For each quote, `total` is within 1 cent of the fee sum, OR the shortfall is a
promotion documented above (Uber Eats -0.98 rows, Cafe Landwer DoorDash, Malatown
Uber Eats).

## Error Handling

- A row missing a required numeric field is omitted rather than guessed; the only
  such rows here are the empty Pho Le rows (omitted).
- `etaMinutes` midpoints round to the nearest integer.

## Testing Strategy

- After writing the file: `node` check that it parses, every `app` is valid, no
  `SAMPLE` restaurant, and each restaurant has consistent `restaurant`/`items`
  (Properties 1-3).
- Reconcile `total` vs. fee sum and confirm the only >1-cent gaps are the
  documented promos (Property 4).
- Run the pre-push gate: `npx tsc --noEmit`, `npx eslint src`, `npm run build`.
- Spot-check `/api/food` + the Money screen locally (manual) to confirm the
  banner is gone — left to the team since it needs the dev server.
