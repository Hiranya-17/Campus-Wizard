# Requirements Document

_T5: Import real delivery prices into data/food.json_

## Introduction

`/api/food` currently serves sample data (restaurant names start with `SAMPLE`)
because `data/food.json` does not exist. The Money screen shows a "sample data"
banner whenever any quote's restaurant starts with `SAMPLE`
(`src/app/money/page.tsx`). This spec imports the delivery prices collected by
hand by Person D into `data/food.json`, matching the `FoodQuote` contract, so the
comparison uses real numbers and the banner disappears automatically.

The source is a spreadsheet of orders across DoorDash, Uber Eats and Grubhub for
several Boston restaurants. The sheet does not line up 1:1 with `FoodQuote`, so
the import follows the mapping decisions recorded below (confirmed with the team).

## Glossary

- **FoodQuote:** the per-app quote shape in `src/lib/types.ts`
  (`restaurant, app, items, subtotal, deliveryFee, serviceFee, smallOrderFee,
  tax, total, etaMinutes, acceptsConveniencePoints, checkedAt`).
- **DeliveryApp:** the union `"DoorDash" | "Uber Eats" | "Grubhub"` — note the
  canonical spelling is "Grubhub" (the sheet writes "GrubHub").
- **Sample banner:** the notice shown on the Money screen while any quote's
  restaurant starts with `SAMPLE`.

## Requirements

### Requirement 1: Create data/food.json from the collected prices

**User Story:** As a student comparing delivery, I want real prices in the app, so the cheapest-app comparison reflects reality instead of sample data.

#### Acceptance Criteria
1. WHEN the import is complete THEN `data/food.json` SHALL exist and contain a JSON array of `FoodQuote` objects.
2. WHEN a row in the source has all required numeric fields THEN it SHALL produce exactly one `FoodQuote`.
3. WHEN all rows for a restaurant are imported THEN they SHALL share the same `restaurant` and `items` values so the comparison groups them together.
4. WHEN the file is written THEN no restaurant name SHALL start with `SAMPLE`, so the sample banner is not shown.

### Requirement 2: Correct field mapping

**User Story:** As a developer, I want each spreadsheet column mapped to the right `FoodQuote` field, so totals and rankings are correct.

#### Acceptance Criteria
1. WHEN mapping the app name THEN "GrubHub" SHALL be normalized to "Grubhub"; "DoorDash" and "Uber Eats" SHALL be used as-is; the value SHALL be a valid `DeliveryApp`.
2. WHEN mapping items THEN the sheet's "Order Details" SHALL become `items`.
3. WHEN mapping money fields THEN "Item Subtotal" -> `subtotal`, "Delivery Fee" -> `deliveryFee`, "Service Fee" -> `serviceFee`, "Tax" -> `tax`, "Other fees (ex. bag fee)" -> `smallOrderFee` (0 when blank), and "Total Before Tip" -> `total`.
4. WHEN "Delivery Time (mins)" is a range (e.g. "10-30") THEN `etaMinutes` SHALL be the integer midpoint.
5. WHEN the source has no convenience-points column THEN `acceptsConveniencePoints` SHALL be `false` for every quote.
6. WHEN the source has no checked-at timestamp THEN `checkedAt` SHALL be a single ISO timestamp (the import date) applied to all quotes.

### Requirement 3: Handle the known data problems

**User Story:** As a developer, I want the known bad/missing rows handled explicitly, so the file contains only trustworthy quotes.

#### Acceptance Criteria
1. WHEN a restaurant's rows are entirely empty / marked "No / Verify" (the Pho Le Restaurant rows) THEN they SHALL be omitted from `data/food.json`.
2. WHEN the Cafe Landwer / DoorDash row is imported THEN the column-shift SHALL be corrected: `total` = 26.26 and the 6.75 value (a promotion/discount) SHALL NOT be used as the total.
3. WHEN a row is omitted or corrected THEN the reason SHALL be recorded in the design/notes so the decision is auditable.

### Requirement 4: Stay consistent and not break the build

**User Story:** As the team, I want the import to keep the app healthy, so the live demo stays safe.

#### Acceptance Criteria
1. WHEN `data/food.json` is present THEN `getFood()` SHALL return it instead of `sampleFood` (existing behavior in `src/lib/data.ts`), with no code change required.
2. WHEN each quote is validated THEN `total` SHALL be within one cent of `subtotal + deliveryFee + serviceFee + smallOrderFee + tax` OR the discrepancy SHALL be explained in notes (promotions/discounts can make the printed total lower).
3. WHEN the import is done THEN `npx tsc --noEmit`, `npx eslint src`, and `npm run build` SHALL all pass.
4. WHEN `data/food.json` is added THEN it SHALL NOT be gitignored (only `/data/.local-db.json` is).
