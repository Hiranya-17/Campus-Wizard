# Rhett: handoff for Kiro

Everything an agent needs to keep building this project without the original conversation. Read it fully before changing code. The README covers features, setup and testing instructions for judges; this file covers how the code works, what's decided, and what's left.

## 1. What this is and the deadlines

Rhett is a mobile-first web app that helps Boston University students with registration, weekly planning, getting to class and money. One AI assistant ("Rhett") can see and act on all of it.

| Event | Track | Deadline |
| --- | --- | --- |
| Hackachusetts 2026 | Civic Action, challenge V4 "Better college experiences" | Submit by **7:30 pm Oct 24, 2026** (hard deadline 8 pm) |
| DS+X 2026 (BU Spark!) | College | **11 am Oct 25, 2026** |

Hackachusetts rules that constrain the remaining work:

- **The project must be built with Kiro, and the repo must contain a `.kiro/` folder at its root** (never gitignored). Insufficient Kiro use is grounds for disqualification, and "Implementation" (how well Kiro was used: specs, hooks, steering, MCP, property-based tests, powers) is one of three judging criteria.
- So far the backend, data pipeline and first UI were written with Claude Code. **All remaining work happens in Kiro**, using its features for real, and the submission write-up must describe that honestly.
- Demo video under 3 minutes, public on YouTube/Vimeo, showing the app on a phone, with no third-party logos or copyrighted music.
- Judges must be able to test it: the live app works without logging in.

Live app: https://ds-x-hackachusetts.vercel.app · Repo: https://github.com/Hiranya-17/DS-X-HACKACHUSETTS (public). Pushing to `main` auto-deploys on Vercel in about a minute.

## 2. Stack

- Next.js 15.5.28 (App Router, `src/`), React 19, TypeScript, Tailwind CSS v4. Keep Next on a patched 15.5.x: Vercel refuses to build vulnerable versions.
- No UI library: small primitives in `src/components/ui.tsx` (`Card`, `Button`, `Pill`, `PageTitle`). BU red is the Tailwind color `bu` (`#cc0000`).
- AI: Google Gemini REST API, model `gemini-3.5-flash` (the only model this key can use; others return 404). All calls go through `src/lib/agent/geminiFetch.ts`.
- Storage for accounts: Redis on Vercel (`REDIS_URL`, TCP via the `redis` package) or Upstash REST; a local JSON file (`data/.local-db.json`, gitignored) in development. See `src/lib/store.ts`.
- External APIs: MBTA V3 (live Green Line B), National Weather Service hourly forecast, Google Gemini. No keys needed except Gemini.

Commands: `npm run dev`, `npx tsc --noEmit`, `npx eslint src`, `npm run build`. All three checks must pass before pushing; a broken push breaks the live demo.

## 3. Environment variables

See `.env.example`. On Vercel these are set: `GEMINI_API_KEY` (billing enabled, so limits are fine now), `AUTH_SECRET`, `REDIS_URL`. Never commit `.env.local` or print keys.

## 4. Data model (all in `src/lib/types.ts`)

- **Times are minutes after midnight** (`545` = 9:05 am). **Days are `"Mon"`…`"Sun"`**. Formatting helpers in `src/lib/format.ts`.
- `Course`: code like `"ENG EC 311"`, title, units (string), hub areas, description, `prereqText`, `prereqs` (**AND of ORs**: `[["CAS MA 123"], ["ENG EK 125","CAS CS 111"]]`), `coreqs`, `recommended`, `minStanding`, `level`, `sections`.
- `Section`: term (`"Fall 2026"`), section id (`"A1"`), instructor, location (`"PHO 203"`), schedule `{raw, days, start, end}`, notes. One section id can appear on several rows when it meets at two different times.
- `Major`: term-by-term `plan` of slots (`course` | `elective` group | `hub`), `electiveGroups`, `hubRequired`, notes.
- `Profile` (the user): `name`, `majorId`, `standing`, `term` (the term being planned, default `"Fall 2026"`), `completed` (**courses finished BEFORE `term`**), `semester` (**the student's chosen classes and sections for `term`**, stored as a `SemesterPlanResponse`), `prefs` (week preferences), `clubs` (fixed weekly events), `home` (building code where the day starts), `expenses`, `budget`.
- `ChatCard`: structured results Rhett returns. `kind: "schedule"` = Rhett changed the schedule (applied immediately by the client); `kind: "semester"` = a suggestion shown with "Use this as my schedule"; also `week`, `food`, `budget`, `expense`, `course`.

## 5. Data files

| File | What | How it's made |
| --- | --- | --- |
| `data/courses.json` (8 MB) | 7,620 BU courses; 3,626 with Fall 2026 sections (9,577 rows). No Spring 2027 sections exist publicly yet. | `python3 scripts/scrape_bu_courses.py` (pages cached in `scripts/.cache/`). **BU rate-limits: it returned 403 at 10 parallel requests. Use `--workers 2 --delay 1.5`, or `--offline` to rebuild from cache.** |
| `data/majors/*.json` | CE (from the official planning sheet PDF), EE, ME, BME (parsed from the BU Bulletin with `scripts/build_eng_major.py`), CS BA and DS BS (hand-written from Bulletin requirement groups; order follows prerequisites) | — |
| `data/buildings.json` | 33 BU building codes and dorms with coordinates | Geocoded with OpenStreetMap Nominatim (credit required, in README) |
| `data/food.json` | **Does not exist yet.** `/api/food` serves sample prices (restaurant names start with `SAMPLE`) until it does. | Person D collects real prices by hand (see task T5) |

## 6. File map

```
src/lib/
  types.ts            shared contracts (change only with care: screens, API and agent all depend on them)
  sections.ts         how BU sections fit together (see §7) — sectionOptions, pickSections, sectionsOverlap
  schedule.ts         schedule helpers: withCourse, withoutCourse, conflicts, clashesWith
  planner/semester.ts suggests a schedule from the major sheet (eligibility, standing, Hub, electives)
  planner/week.ts     fits meals, gym, study, tasks and sleep around fixed events; classEvents()
  transit.ts          leave-by routing: walk vs Green Line B, live MBTA, NWS weather (server only)
  budget.ts           semester spending summary; purchases >= $75 count as one-time in projections
  food.ts             groups delivery quotes by restaurant, cheapest first
  ics.ts              .ics calendar export
  auth.ts, store.ts   accounts (scrypt passwords, HMAC-signed httpOnly cookie) and key-value storage
  profile.ts          client hook useProfile(): guest profile in localStorage, or the account profile synced to /api/profile
  demo.ts             DEMO_PROFILE (CE sophomore, freshman year done), defaults, starterProfile, standingFor
  data.ts             server-side loaders for data/*.json
  agent/              Rhett: gemini.ts (tool-calling loop + system prompt), tools.ts (all tools), rules.ts (no-AI fallback),
                      extract.ts (club emails/syllabi -> events), receipts.ts (receipts/emails -> expenses), geminiFetch.ts
src/components/       ScheduleCalendar, SectionPicker, CourseHistoryPicker, ChatPanel, RouteCard, BudgetView, views, BottomNav, ui
src/app/              page.tsx (Home), plan/, week/, money/ (budget + delivery tabs), chat/, account/, food/ (redirects to money)
src/app/api/          courses, majors, plan/semester, plan/week, week.ics, chat, extract-events, expenses/extract,
                      food, transit, profile, auth/{signup,login,logout,me}
scripts/              scrape_bu_courses.py, build_eng_major.py
```

## 7. Hard-won rules (don't regress these)

1. **BU section structure** (`src/lib/sections.ts`, tested against all 3,626 Fall courses):
   - WR 153: every section is a full class; pick one.
   - MA 226: lecture A1 owns discussions A2–A6; lecture B1 owns B2–B5.
   - EC 311: lecture A1 plus any lab C1–C5.
   - PY 212: discussions run D1–D9, E1–E9, F1 and labs L1–L9, M1–M9, N1 — letters continue a pool, so shared companions merge **by kind (discussion/lab), not by letter**. A course never requires more than one discussion and one lab.
   - CS 111: one section id can meet at two times (A1 = MWF 10:10 and W 6:30 pm); rows with the same id are one choice ("unit").
   - Lectures are units meeting on 2+ days a week or close to the longest weekly time; discussions/labs meet once a week. When unsure, require fewer picks, never more.
2. **The guest demo must always work without login** (judges test this way). Guest data lives in localStorage key `rhett.profile.v2`; bump the version if the demo profile changes shape.
3. **Rhett must never break the demo:** every Gemini call falls back to `agent/rules.ts`. 503s retry with backoff; a daily-quota 429 pauses Gemini for at most 10 minutes.
4. Components that change the profile receive `profile` and `update` from their page (one `useProfile()` per page); a second `useProfile()` in a child would hold separate state.
5. React effects must not return values: write `useEffect(() => { el?.scrollIntoView(); }, [...])` with braces (Chrome's `scrollIntoView` returns a Promise).
6. When a `SectionPicker` opens for a different course it must remount (`key={course.code}`) so picks never carry over.
7. Don't scrape DoorDash/Uber Eats/Grubhub (terms of service, bot blocking). Delivery prices are hand-collected. Don't fake BU shuttle times: no public feed exists (the old `bu.edu/bumobile/rpc/bus` endpoint is dead); the app links to Terrier Transit instead.

## 8. Status

Done and live: course search with every section, live calendar with clash preview, lecture/discussion/lab grouping, prerequisite warnings, Rhett panel on the Plan page that adds/drops/finds sections, schedule suggestion from major sheets (6 majors), week planner with email/syllabus event extraction and .ics export, leave-by routing with live MBTA and weather plus reminders, budget with receipt/email reading and pace projection, delivery comparison (sample data), accounts with server-side profiles, course history at sign-up.

Known gaps:
- Spring 2027 sections aren't published by BU; the term switch says so.
- No automated tests yet.
- `src/mocks/` is leftover from the first scaffold; only `sampleFood` is still used.
- The name "Rhett" is BU's trademarked mascot; the team may rename the app before recording the video (pending decision).

## 9. Remaining work, in priority order (do these in Kiro)

Each task maps to a Kiro capability the judges score. Keep the steering docs, specs, hooks and tests in `.kiro/` committed.

- **T1. Steering (first, ~15 min).** Generate steering docs from this repo (product, tech, structure), then refine them with §2, §4 and §7 of this file so every later spec follows the same contracts and rules.
- **T2. Property-based tests for `sections.ts` and `schedule.ts` (spec + PBT).** Add a test runner (e.g. Vitest + fast-check). Properties worth testing against generated sections and against real `data/courses.json` entries:
  - `pickSections` never returns two overlapping sections, and never overlaps the `taken` sections passed in.
  - Every `sectionOptions` option has at most one Discussion group and at most one Lab group.
  - Every unit in an option shares one section id; every section of the course appears in some option.
  - `withoutCourse(withCourse(s, c), c.code)` has the same courses as `s` when `c` wasn't already in `s`; `totalUnits` always equals the sum of course units.
  - `conflicts` is symmetric and empty for any output of `pickSections` built course by course.
- **T3. Agent hooks.** On save of `src/**/*.ts(x)`: run `npx tsc --noEmit` and `npx eslint`. On change to `data/majors/*.json`: validate against the `Major` type (every course code exists in `data/courses.json`, every elective slot names a defined group).
- **T4. Gmail club-email sync (spec; owner C).** Google OAuth (Testing mode, gmail.readonly), fetch recent club newsletters, send each to `POST /api/extract-events`, and let the user add weekly meetings to `profile.clubs` (same UI as the "Paste a club newsletter" box on the Week page). Keep the paste box as the no-login fallback.
- **T5. Real delivery prices (spec; owner D supplies data).** Import D's spreadsheet into `data/food.json` matching `FoodQuote` (restaurant, app, items, subtotal, deliveryFee, serviceFee, smallOrderFee, tax, total, etaMinutes, acceptsConveniencePoints, checkedAt). Once it exists, the sample banner disappears automatically.
- **T6. Onboarding and UI polish (spec; owner B).** First-visit intro explaining guest demo vs. account, empty states, loading skeletons, accessibility pass (labels, focus states, color contrast), app name/logo if renamed.
- **T7. Google Calendar sync (optional).** Push the planned week to Google Calendar; the .ics download stays as fallback.

Before each push: `npx tsc --noEmit && npx eslint src && npm run build`, then check the live site after deploy.

## 10. Submission checklist

- [ ] `.kiro/` at repo root with steering, specs and hooks; not in `.gitignore`
- [ ] Kiro write-up: tools used (IDE/CLI/Web), how specs were structured and what spec-driven changed vs. vibe coding, hooks and what they automated, steering strategy, MCP use, what property-based tests caught, powers used. Disclose that Claude Code built the initial backend and data pipeline.
- [ ] Text description of features (README "Features" section can be reused)
- [ ] Demo video < 3 min, public, filmed on a phone, no third-party logos or copyrighted music
- [ ] Track selected: Civic Action (V4); repo URL; live app URL; testing instructions (README "Testing instructions")
- [ ] All 4 team members added on the submission form
