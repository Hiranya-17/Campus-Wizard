# How we used Kiro

CampusWizard (called "Rhett" in the earlier specs) is a mobile-first web app for BU students: a registration planner with real sections, a week planner, transit leave-by times, a budget, food and dining, and an AI assistant across all of it.

This folder holds everything Kiro produced for the project: steering docs, four specs and two agent hooks. This page explains what each piece did, what it caught, and which parts of the app were built with other tools.

**How we ran Kiro:** in the **Kiro IDE**, with three of us working in it:

- Hiranya Bansal: steering, plus tasks T2, T3 and T5;
- Harsh Patel: the frontend spec;
- Naman Shastry: Google sign-in, Gmail and Calendar, and the dining halls.

We didn't use MCP servers.

## At a glance

| Kiro feature | Where it is | What it did for the project |
| --- | --- | --- |
| Steering | `steering/product.md`, `tech.md`, `structure.md` | Gave every Kiro session the same ground rules: BU's section model, the pinned Next.js and Gemini versions, which files own what, and "never push a failing build" |
| Spec: property-based tests | `specs/t2-property-tests/` | 10 fast-check properties over generated sections and every real BU course with Fall 2026 sections; found how BU repeats rows within a section |
| Spec + hooks | `specs/t3-agent-hooks/`, `hooks/` | A major-sheet validator and two hooks that check types, lint and degree data on every save; found 21 course codes the scrape was missing |
| Spec: data import | `specs/t5-food-data/` | Turned the team's hand-collected delivery prices into `data/food.json`, with each data problem handled deliberately |
| Spec: frontend | `specs/rhett-frontend/` | Requirements, design and tasks for the first polished screens, the typed API client and the accessibility pass |
| Feature build (Naman) | dining halls (commit `3fa0632`) | Dining halls with hours, open-now status, sample menus and cuisine recommendations |
| Feature build (Naman) | Google sign-in, Gmail import, Calendar export (PR #2) | OAuth 2.0 sign-in, reading club and order emails into the extractors, and exporting the week to Google Calendar |

## Steering

Hiranya wrote three steering docs first (task T1), grounded in the code and in `docs/KIRO_HANDOFF.md`:

- **`product.md`**: who the app is for, the default demo student (a CE sophomore), and the hackathon context.
- **`tech.md`**: the stack and the rules that broke things when ignored:
  - keep Next.js on a patched 15.5.x, because Vercel refuses to build vulnerable versions;
  - use only `gemini-3.5-flash`, because the API key can't use any other model;
  - go through `store.ts` rather than talking to Redis directly;
  - don't start the dev server from an agent.
- **`structure.md`**: a map of `src/lib` and what each module owns, plus how BU sections fit together. Rows that share a section id form one unit; a course takes one lecture plus at most one discussion and one lab.

Every later spec cites these rules instead of repeating them. Task T2's design, for example, defines a schedule conflict "per the section-unit rule in steering".

## Specs

All four specs use Kiro's requirements-first workflow: `requirements.md` (user stories with numbered acceptance criteria), then `design.md`, then `tasks.md` (a checklist with a dependency graph). Each spec ends with the same gate: run tsc, eslint, the tests and `next build`, and fix everything before pushing.

### T2: property-based tests for the schedule engine

`specs/t2-property-tests/` covers `src/lib/sections.ts` (how lectures, discussions and labs combine) and `src/lib/schedule.ts` (adding, dropping and clash detection).

- **Tooling:** Vitest 2.1.9 and fast-check 3.23.2, pinned. The Vite config was changed so the Tailwind config doesn't break test runs.
- **Generators:** `tests/gen/sections.ts` builds the five shapes BU sections come in.
- **Real data:** a memoised loader runs the same checks over every real course in `data/courses.json`.
- **Ten properties:**
  - `pickSections` never returns a clash;
  - companion groups have the right shape;
  - unit identity and option coverage;
  - overlap is symmetric and safe with missing times;
  - add then drop restores the schedule;
  - total credits equal the sum of the parts;
  - replacing a course is different from adding one;
  - conflicts are symmetric;
  - a clean build has no conflicts.
- **The rule that paid off:** requirement 7.3 says a failing real-data property is treated as a likely bug in the code, investigated before the property is weakened.

**What it caught.** Property 1 failed on real courses. BU lists some sections as several rows: CS 111 meets at two different times within one section, and some rows, like CAS IN 299, are exact duplicates. These rows "overlap" with each other without being a clash. The fix was to define a conflict only between different section ids. The duplicate rows it exposed (118 of them) were later removed in the course scraper as well.

### T3: agent hooks and the major-sheet validator

`specs/t3-agent-hooks/` produced `scripts/validate-majors.mjs` and the two hooks in `hooks/`.

- **The validator:** a plain Node script with no build step.
  - Errors (exit 1): an undefined elective group, an unknown slot kind, bad JSON.
  - Warnings: course codes that aren't in the scraped catalogue. The scrape was known to be incomplete, so the spec deliberately made these warnings, not errors.
- **`typecheck-lint-on-save`:** when any `src/**/*.ts(x)` file is saved, Kiro runs `tsc --noEmit` and `eslint src` and reports the result. It never edits, commits or pushes.
- **`validate-major-on-change`:** when a `data/majors/*.json` file changes, Kiro runs the validator on that file and reports its output word for word.

**What it caught.** The six shipped majors referenced 21 course codes missing from the scrape, such as CAS CH 101 and CAS WR 150. Tracing them showed two separate problems:

- BU's college-wide course feed leaves out whole departments, including Chemistry. The scraper now also walks the department feeds, which added 62 courses.
- Some codes really are retired. WR 150 and five CE electives were removed from the major sheets.

The validator also became part of `npm run check`, the command the whole team runs before pushing.

### T5: real delivery prices

`specs/t5-food-data/` turned the delivery prices our non-technical teammate collected by hand into `data/food.json`: 24 quotes, for 8 restaurants near campus on DoorDash, Uber Eats and Grubhub.

The requirements spelled out each mapping decision and each known data problem before any data was written:

- "GrubHub" becomes "Grubhub", and delivery time is the midpoint of the range shown.
- Empty rows (Pho Le) are left out.
- A column shift in the sheet is corrected: Cafe Landwer's DoorDash total is $26.26, not the $6.75 promotion.
- The printed totals stay authoritative even where they are lower than the sum of the fees. Every Uber Eats row has a $0.98 promotion, Cafe Landwer on DoorDash $6.75, and Malatown on Uber Eats $3.00.

That last decision is why the app's fee table has a "Promotions" row, so the numbers always add up for the student.

### Frontend spec (rhett-frontend)

`specs/rhett-frontend/` was written and carried out in Kiro by Harsh Patel. It has nine requirements:

- Home, the registration planner, the week planner and chat;
- a food placeholder;
- bottom navigation;
- mobile-first UX and accessibility;
- a typed API client with mock data;
- the web app manifest.

Tasks 1–8 and 10 are done: the typed `src/lib/api.ts`, ARIA labels and 44px tap targets in the navigation, polished screens, a checked manifest, and an accessibility audit. The work merged as PR #1. Main's newer pages were kept, and the spec's error states, live regions, labels and input limits were carried onto them.

Two tasks are still open: task 9 (frontend property tests P1–P5) and task 11 (the final checkpoint).

## Features built in Kiro sessions

Both were built by Naman Shastry in the Kiro IDE.

- **Dining halls** (commit `3fa0632`, co-authored by Kiro). Kiro built `data/dining.json`, the dining API routes, hours with open-now status, sample menus and cuisine recommendations. It worked on a downloaded copy of the repo, and the change was then applied onto current main. The integration also gave the assistant a `dining_halls` tool.
- **Google sign-in, Gmail import and Google Calendar export** (PR #2, task K4 in `docs/KIRO_TASKS.md`).
  - OAuth 2.0 sign-in with token refresh and revocation;
  - reading recent emails into the event and expense extractors;
  - exporting the week plan to Google Calendar, including a fix for re-exporting events that had been deleted.

## What else built the app

Kiro was not the only tool. The first version of the project was written with **Claude Code** before the Kiro phase started, and `docs/KIRO_HANDOFF.md` records the plan for moving the remaining work into Kiro:

- the BU course scraper and data pipeline;
- the backend and the AI assistant;
- the first screens.

Claude Code was also used throughout the day for:

- merging the team's pull requests;
- integration fixes and a security pass;
- syllabus import, Gmail club-meeting scanning and linking several Gmail inboxes;
- the CampusWizard redesign with its first-run tour.

The Kiro work above is what's committed in this folder and in the commits linked here.

## Running what Kiro set up

```bash
npm install
npm run check   # tsc, eslint, the property tests, and the major-sheet validator
```

In Kiro, the two hooks in `hooks/` run on their own when matching files are saved.
