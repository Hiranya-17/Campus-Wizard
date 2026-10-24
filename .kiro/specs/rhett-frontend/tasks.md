# Implementation Plan: Rhett Frontend

## Overview

Implement all Person B frontend tasks for the Rhett Next.js 15 PWA: the typed API client, BottomNav update, five page polishes (Home, Plan, Week, Chat, Manifest), property-based tests, and an accessibility audit. All work lives in `src/` except the manifest check in `public/`. No `src/app/api/`, `src/app/food/`, `src/lib/types.ts`, `src/lib/demo.ts`, or `src/lib/planner/` files are touched.

---

## Tasks

- [x] 1. Create `src/lib/api.ts` — typed API client with mock bypass
  - [x] 1.1 Define `ApiError` class and the private `post<TReq, TRes>` helper
    - Export `ApiError extends Error` with a `status: number` field
    - Implement `post` using browser-native `fetch`; throw `ApiError` on non-2xx responses
    - No `any` types; no new npm dependencies
    - _Requirements: 8.3, 8.4, 8.5_

  - [x] 1.2 Implement `postSemesterPlan`, `postWeekPlan`, and `postChat` with mock bypass
    - Read `NEXT_PUBLIC_USE_MOCKS`; when `"true"` return `mockSemesterPlan`, `mockWeekPlan`, or a stub `ChatResponse` without calling `fetch`
    - Each function sets `Content-Type: application/json` and returns a typed promise
    - `postChat` implements a **30-second `AbortController` timeout** internally: create an `AbortController`, set `setTimeout(() => controller.abort(), 30_000)`, pass `signal` to `fetch`, and clear the timer in a `finally` block
    - _Requirements: 4.4, 4.8, 8.1, 8.2, 8.6, 8.7, 8.8_

  - [ ]* 1.3 Write unit tests for `src/lib/api.ts`
    - Test that `postSemesterPlan` sets `Content-Type: application/json`
    - Test that `postSemesterPlan` throws `ApiError` on a 500 response
    - Test that `postWeekPlan` throws `ApiError` on a 404 response
    - _Requirements: 8.2, 8.3_

- [x] 2. Update `BottomNav` — Food tab, ARIA, tap targets
  - [x] 2.1 Replace the Money tab with a Food tab
    - Change `{ href: "/money", label: "Money", icon: "money" }` to `{ href: "/food", label: "Food", icon: "food" }`
    - Verify the `food` SVG path is present in the `ICONS` map; add it if missing
    - _Requirements: 6.1, 6.2_

  - [x] 2.2 Add `aria-hidden="true"` to each SVG icon and verify 44 px tap targets
    - Add `aria-hidden="true"` to the `<svg>` element inside each tab link
    - Increase tab link padding to at least `py-3` if the rendered height is below 44 px
    - _Requirements: 6.7, 7.2, 7.3_

  - [ ]* 2.3 Write unit tests for `BottomNav`
    - Test that the component renders exactly 5 tabs
    - Test that tab index 3 links to `/food` and is labeled "Food"
    - _Requirements: 6.1, 6.2_

- [x] 3. Polish Home page (`src/app/page.tsx`)
  - [x] 3.1 Switch API calls to `postSemesterPlan` / `postWeekPlan` from `src/lib/api.ts`; add mock bypass and error state
    - Import and use `postSemesterPlan` and `postWeekPlan` instead of raw `fetch` calls
    - When `NEXT_PUBLIC_USE_MOCKS === "true"`, resolve immediately with `mockWeekPlan` (skip semester fetch too)
    - Wrap the `useEffect` data fetch in `try/catch/finally`; on failure set an `error` string; clear loading in `finally`
    - _Requirements: 1.9, 1.10, 1.11, 1.12, 8.1_

  - [x] 3.2 Add whitespace guard on Ask Rhett form and sort upcoming events ascending
    - Prevent `router.push` when `ask.trim()` is empty or whitespace-only; keep focus on the input
    - Sort the filtered `upcoming` array ascending by `e.start` before slicing to 5
    - _Requirements: 1.2, 1.3, 1.5_

  - [x] 3.3 Extract `HomeSchedulePreview` component (inline in `page.tsx`)
    - Accept `{ today: WeekEvent[] | null; error: string | null; currentMinutes: number }` props
    - Render the four states: loading (`today === null`), error, empty (no upcoming), and up-to-5 `EventRow` items
    - Apply `role="status"` + `aria-live="polite"` to the loading paragraph; `role="alert"` to the error card
    - _Requirements: 1.5, 1.6, 1.7, 1.12, 7.3_

  - [x] 3.4 Extract `QuickActionGrid` component (inline in `page.tsx`) and update tiles
    - Accept `{ tiles: QuickActionTile[] }` props; render a `grid grid-cols-2 gap-3` of `<Link>` cards
    - Replace the current Money tile with a **Food tile** pointing to `/food` (label: "Food", body: "Compare food delivery prices and find the best deal") — keep the remaining three tiles (Plan, Week, Chat) unchanged
    - All tile body descriptions must be ≤ 60 characters
    - _Requirements: 1.8, 5.1_

  - [ ]* 3.5 Write unit tests for Home page components
    - Test `HomeSchedulePreview` renders loading state when `today === null`
    - Test `HomeSchedulePreview` renders empty state when no upcoming events remain
    - Test `HomeSchedulePreview` shows at most 5 events, sorted ascending by `start`
    - _Requirements: 1.5, 1.6, 1.7_

- [x] 4. Polish Plan page (`src/app/plan/page.tsx`)
  - [x] 4.1 Switch to `postSemesterPlan` from `src/lib/api.ts` and add error state
    - Replace the raw `fetch("/api/plan/semester", …)` in `build()` with `postSemesterPlan()`
    - Wrap `build()` in `try/catch/finally`; on failure set `error` string and re-enable the button; clear error on retry
    - Display the error message below the "Build my plan" button with `role="alert"`
    - _Requirements: 2.8, 2.9, 2.10, 8.1_

  - [x] 4.2 Add "No courses found" empty state to course search dropdown
    - When `extra.trim().length >= 3` and `hits` is an empty array after the debounced fetch, render a "No courses found" item in the dropdown
    - _Requirements: 2.6_

  - [x] 4.3 Extract `PlanCourseChecklist` component (inline in `plan/page.tsx`)
    - Accept `{ major, completed, offSheet, onToggle }` props
    - Pure rendering: completed pills use `border-bu bg-bu text-white`; not-completed use `border-zinc-300 bg-white text-zinc-700`; off-sheet courses show a `×` dismiss button
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ]* 4.4 Write unit tests for Plan page
    - Test that "No courses found" is shown when `GET /api/courses` returns `[]`
    - Test that the "Use this as my semester" button shows "Saved as my semester ✓" when `plan === profile.semester`
    - _Requirements: 2.6, 2.14_

- [x] 5. Polish Week page (`src/app/week/page.tsx`)
  - [x] 5.1 Switch to `postWeekPlan` from `src/lib/api.ts`; add separate error states for plan build and ICS download
    - Replace raw `fetch("/api/plan/week", …)` in `build()` with `postWeekPlan()`
    - Wrap `build()` in `try/catch/finally`; on failure set `buildError` and re-enable the button
    - Wrap `downloadIcs()` in `try/catch/finally`; on failure set `icsError` that shows without clearing `plan`
    - Add `role="alert"` to both error paragraphs
    - _Requirements: 3.11, 3.13, 3.15, 3.16, 8.1_

  - [x] 5.2 Extract `WeekPrefsForm` with enforced min/max constraints
    - Accept `{ prefs: WeekPrefs; onChange: (patch: Partial<WeekPrefs>) => void }` props
    - Set HTML `min`/`max`/`step` on each numeric input per design table and clamp in `onChange` before calling `props.onChange`
    - Wake-time field uses `<input type="time">` with `fromInputTime`/`toInputTime` helpers
    - _Requirements: 3.7, 3.8_

  - [x] 5.3 Extract `WeekToDoList` with input validation
    - Accept `{ tasks, onRemove, onAdd }` props; manage local draft state for `name`, `minutes`, `timesPerWeek`
    - Disable "+" when `name.trim()` is empty; clamp `minutes` to 1–480 and `timesPerWeek` to 1–7 before calling `onAdd`
    - _Requirements: 3.9, 3.10_

  - [ ]* 5.4 Write unit tests for Week page components
    - Test `WeekPrefsForm` clamps `gymMinutes` to 15–240
    - Test `WeekToDoList` "+" button is disabled when `name.trim()` is empty
    - _Requirements: 3.7, 3.10_

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Polish Chat page (`src/app/chat/page.tsx`)
  - [x] 7.1 Switch Chat page to use `postChat` from `src/lib/api.ts`
    - Replace the inline `fetch("/api/chat", …)` call with `postChat({ messages, profile })` imported from `src/lib/api.ts`
    - Remove the `AbortController` / `setTimeout` code from the Chat page — the 30-second timeout now lives inside `postChat` (implemented in Task 1.2)
    - Catch `ApiError` and any network error; append "I couldn't reach the server. Try again?" as an assistant turn and re-enable the send button
    - _Requirements: 4.4, 4.8, 8.1_

  - [x] 7.2 Add 500-character `maxLength` to the chat input
    - Add `maxLength={500}` to the `<input>` element in the sticky form
    - _Requirements: 4.9_

  - [x] 7.3 Extract `ChatBubble` component (inline in `chat/page.tsx`)
    - Accept `{ role: "user" | "assistant"; content: string }` props
    - User bubble: right-aligned, `max-w-[85%] rounded-2xl rounded-br-sm bg-bu px-3 py-2 text-sm text-white`
    - Assistant bubble: full-width `<p>` with `whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm shadow-sm`; strip `**` from content
    - _Requirements: 4.3_

  - [x] 7.4 Extract `ChatCards` component (inline in `chat/page.tsx`)
    - Accept `{ cards: ChatCard[] }` props; dispatch by `kind` to the existing `SemesterView`, `WeekView`, `FoodView`, `BudgetView`, `CourseView`, or a green expense confirmation pill
    - _Requirements: 4.5, 4.6_

  - [ ]* 7.5 Write unit tests for Chat page
    - Test that the chat input accepts at most 500 characters
    - Test that the auto-send `?q=` param fires exactly once on mount
    - _Requirements: 4.9, 4.10_

- [x] 8. Verify manifest and icon (`public/manifest.webmanifest`, `public/icon.svg`)
  - [x] 8.1 Confirm all 6 required manifest fields are correct
    - Read `public/manifest.webmanifest` and verify: `name`, `short_name`, `theme_color`, `background_color`, `icons` (pointing to `/icon.svg` with `"sizes": "any"`), `display`, and `start_url`
    - Confirm `src/app/layout.tsx` emits `<link rel="manifest">` via `metadata.manifest`
    - Make no changes if all fields are already correct (design.md documents them as ✅)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 9. Add property-based tests (fast-check P1–P5)
  - Install `fast-check` as a dev dependency: `npm install --save-dev fast-check`
  - [ ] 9.1 Write P1 — BottomNav active-tab mutual exclusion (`src/components/BottomNav.test.tsx`)
    - Generator: `fc.string()` for pathname
    - Render with React Testing Library; assert exactly one element with `text-bu` class in the nav for any pathname
    - Tag: `// Feature: rhett-frontend, Property 1: BottomNav active-tab mutual exclusion`
    - _Requirements: 6.3, 6.4_

  - [ ] 9.2 Write P2 — Completed-courses toggle idempotency (`src/app/plan/planToggle.test.ts`)
    - Generator: `fc.array(fc.string())` for initial completed; `fc.string()` for code to toggle
    - Call the toggle function twice; assert set-equivalence with the original array
    - Tag: `// Feature: rhett-frontend, Property 2: Completed-courses toggle idempotency`
    - _Requirements: 2.5_

  - [ ] 9.3 Write P3 — Chat turn ordering invariant (`src/app/chat/chatTurns.test.ts`)
    - Generator: `fc.array(fc.record({ content: fc.string() }), { minLength: 1, maxLength: 20 })` for N sends
    - Simulate N append pairs; assert `turns.length === 2N`; assert role at index `i` is `"user"` when even, `"assistant"` when odd
    - Tag: `// Feature: rhett-frontend, Property 3: Chat turn ordering invariant`
    - _Requirements: 4.4_

  - [ ] 9.4 Write P4 — Ask Rhett whitespace navigation guard (`src/app/homeNav.test.ts`)
    - Generator: `fc.string().filter(s => s.trim() === "")` for whitespace strings
    - Assert `router.push` is never called for any whitespace-only input
    - Tag: `// Feature: rhett-frontend, Property 4: Ask Rhett navigation guard`
    - _Requirements: 1.3_

  - [ ] 9.5 Write P5 — API client mock bypass consistency (`src/lib/api.test.ts`)
    - Generator: `fc.record({ majorId: fc.string(), … })` for each request type; spy on `globalThis.fetch`
    - Assert `fetch` is never called when `NEXT_PUBLIC_USE_MOCKS === "true"`
    - Tag: `// Feature: rhett-frontend, Property 5: API client mock bypass consistency`
    - _Requirements: 8.6, 8.7, 8.8_

- [x] 10. Accessibility audit
  - [x] 10.1 Apply `role="status"` + `aria-live="polite"` to all loading states; `role="alert"` to all error states
    - Home page loading paragraph, Plan/Week/Chat error paragraphs
    - _Requirements: 7.3_

  - [x] 10.2 Confirm focus management after form submits
    - After Plan page course selection, call `.focus()` on the search input ref
    - After Home page Ask Rhett submit with whitespace, keep focus on the input
    - _Requirements: 7.6_

  - [ ] 10.3 Verify `disabled` attribute discipline across all buttons
    - Confirm all "disabled during loading" buttons use React's `disabled={loading}` (not CSS-only)
    - _Requirements: 7.7_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- `src/lib/api.ts` (Task 1) must be completed before Tasks 3–7 since all pages import from it
- The design document has a **Correctness Properties** section (Properties 1–5), so property-based tests are included
- `fast-check` must be installed before running Tasks 9.1–9.5
- `src/app/food/page.tsx` is **not touched** — Person C owns it; the BottomNav Food tab will return a 404 until Person C delivers the page
- The manifest and icon are already correct per the design document; Task 8.1 is a read-and-verify step only

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "8.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["1.3", "2.3", "3.1", "4.1", "5.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "4.2", "4.3", "5.2", "5.3", "7.1", "7.2"] },
    { "id": 4, "tasks": ["3.5", "4.4", "5.4", "7.3", "7.4", "10.1", "10.2", "10.3"] },
    { "id": 5, "tasks": ["7.5", "9.1", "9.2", "9.3", "9.4", "9.5"] }
  ]
}
```
