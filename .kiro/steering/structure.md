# Structure

## Directory map

```
src/lib/
  types.ts            shared contracts (screens, API and agent all depend on them — change with care)
  format.ts           formatting helpers (minutes-after-midnight -> time strings, etc.)
  sections.ts         how BU sections fit together — sectionOptions, pickSections, sectionsOverlap, units
  schedule.ts         schedule helpers — withCourse, withoutCourse, conflicts, clashesWith, emptySchedule
  planner/semester.ts suggests a schedule from the major sheet (eligibility, standing, Hub, electives)
  planner/week.ts     fits meals, gym, study, tasks, sleep around fixed events; classEvents()
  transit.ts          leave-by routing: walk vs Green Line B, live MBTA, NWS weather (SERVER ONLY)
  budget.ts           semester spending summary; purchases >= $75 count as one-time in projections
  food.ts             groups delivery quotes by restaurant, cheapest first
  ics.ts              .ics calendar export
  auth.ts, store.ts   accounts (scrypt passwords, HMAC-signed httpOnly cookie) and key-value storage
  profile.ts          useProfile(): guest profile in localStorage, or account profile synced to /api/profile
  demo.ts             DEMO_PROFILE (CE sophomore, freshman year done), defaults, starterProfile, standingFor
  data.ts             server-side loaders for data/*.json
  agent/              Rhett: gemini.ts (tool loop + system prompt), tools.ts, rules.ts (no-AI fallback),
                      extract.ts (emails/syllabi -> events), receipts.ts (receipts/emails -> expenses), geminiFetch.ts

src/components/       ScheduleCalendar, SectionPicker, CourseHistoryPicker, ChatPanel, RouteCard,
                      BudgetView, HeaderAccount, views, BottomNav, ui (Card/Button/Pill/PageTitle)

src/app/              page.tsx (Home), plan/, week/, money/ (budget + delivery tabs), chat/, account/,
                      food/ (redirects to money)
src/app/api/          courses, majors, plan/semester, plan/week, week.ics, chat, extract-events,
                      expenses/extract, food, transit, profile, auth/{signup,login,logout,me}

data/                 courses.json, majors/*.json, buildings.json, .local-db.json (gitignored, dev store)
scripts/              scrape_bu_courses.py, build_eng_major.py
.kiro/                steering/, specs/, hooks/ — committed, part of the submission

src/mocks/            leftover from the first scaffold; only `sampleFood` is still used — don't build on this.
```

## Universal units

- **Times are minutes after midnight.** `545` = 9:05 am. Store and compare schedules this way; format only at the edge with `src/lib/format.ts`.
- **Days are `"Mon"` … `"Sun"`** (`Day` type, `DAYS` array). Never use numeric weekday indices in stored data.

## Data contract (from `src/lib/types.ts`)

Treat `types.ts` as the single source of truth. Key shapes:

- **`Course`** — `code` like `"ENG EC 311"`; `title`; `units` (a **string**, not a number); `hub` areas; `description`; `prereqText`; `prereqs` as an **AND of ORs**: `[["CAS MA 123"], ["ENG EK 125", "CAS CS 111"]]` (student must satisfy every inner array, each inner array satisfied by any one of its codes); `coreqs`; `recommended`; `minStanding`; `level`; `sections`.
- **`Section`** — `term` (`"Fall 2026"`); `section` id (`"A1"`); `instructor`; `location` (`"PHO 203"`); `schedule` `{ raw, days, start, end }` (`start`/`end` are `Minutes | null`); `notes`. **One section id can appear on several rows** when it meets at two different times — those rows are one choice.
- **`Major`** — term-by-term `plan` of `Slot`s (`{kind:"course"}` | `{kind:"elective", group}` | `{kind:"hub"}`), plus `electiveGroups`, `hubRequired`, `notes`. Each elective slot's `group` must name a defined `ElectiveGroup` id.
- **`Profile`** (the single user) — `name`, `majorId`, `standing`, `term` (term being planned, default `"Fall 2026"`), `completed` (**courses finished BEFORE `term`**, not the current term's classes), `semester` (the student's chosen classes and sections for `term`, stored as a `SemesterPlanResponse`), `prefs`, `clubs` (fixed weekly events), `home` (building code where the day starts), `expenses`, `budget`.
- **`ChatCard`** — structured results Rhett returns. `kind: "schedule"` means Rhett changed the schedule (client applies it immediately); `kind: "semester"` is a suggestion shown with a "Use this as my schedule" button; also `week`, `food`, `budget`, `expense`, `course`.

When adding a field, extend `types.ts` first, then follow the type through screens, API routes and the agent.

## BU section structure (the hard-won rules in `sections.ts`)

`sectionOptions`, `units` and `pickSections` encode how BU courses register. Tested against all 3,626 Fall courses. Preserve this behavior:

- **WR 153:** every section (E1, F1, K1…) is a full class; pick one.
- **MA 226:** lecture A1 owns discussions A2–A6; lecture B1 owns B2–B5. Pick A1 plus one of A2–A6 (or B1 plus one of B2–B5).
- **EC 311:** lecture A1 plus any one lab C1–C5.
- **PY 212:** when a pool runs past 9 sections BU continues on the next letter (discussions D1–D9, E1–E9, F1; labs L1–L9, M1–M9, N1). Those letters are one pool, so shared companions merge **by kind (discussion/lab), not by letter.** A course never requires more than one discussion and one lab.
- **CS 111:** one section id can meet at two times (A1 = MWF 10:10 and W 6:30 pm). Rows with the same id are one choice — a "unit" is every row sharing a section id.
- **Classifying units:** primaries (lectures/standalone) meet on 2+ days a week or close to the longest weekly time; discussions/labs meet once a week. **When unsure, require fewer picks, never more.**

### Invariants callers and tests rely on

- `pickSections` returns a conflict-free full set (a primary plus one of each required companion) that also does not overlap the `taken` sections passed in, or `null`.
- Every `sectionOptions` option has **at most one** Discussion group and **at most one** Lab group.
- Every unit shares one section id; every section of a course appears in some option.
- In `schedule.ts`: `totalUnits` always equals the sum of course units; `conflicts` is symmetric; `withoutCourse(withCourse(s, c), c.code)` restores `s` when `c` wasn't already present.

These invariants are the subject of the property-based tests in task T2 — keep them true.
