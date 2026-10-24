# Rhett — your BU student assistant

DS+X 2026 (College track) × Hackachusetts 2026 (Civic Action, challenge V4: Better college experiences).

Rhett helps BU students plan registration around prerequisites and their major, plan their week around classes and clubs, and find the cheapest delivery app for the same order.

**Live app:** https://ds-x-hackachusetts.vercel.app (no login needed: it opens as a demo CE sophomore; tap "Log in" to create your own account)

**Track:** Hackachusetts Civic Action, challenge V4 "Better college experiences" · DS+X College track

## Features

- **Build your schedule:** search any of 7,620 BU courses, see every Fall 2026 section with professor, days, times and room, and watch clashes appear on a live weekly calendar before you add a class. Lectures, discussions and labs are grouped the way BU registers them. Missing prerequisites are flagged from the courses you've taken.
- **Rhett, an AI assistant** (Gemini with tool calling) that can see your calendar: find sections, add or drop classes, fix clashes, suggest a schedule from your major's planning sheet, plan your week, check your budget and answer commute questions.
- **Plan my week:** fits sleep, meals, study, gym and to-dos around classes and clubs; reads club emails and syllabi for meetings, exams and deadlines; exports to Google/Apple Calendar (.ics).
- **Getting to class:** "leave by" times for every class, walking vs. the Green Line B with live MBTA departures, National Weather Service forecast, reminders.
- **Money:** semester budget by category with pace projection; log spending from a receipt photo or order email; compare the total cost of the same order on DoorDash, Uber Eats and Grubhub.
- **Accounts:** email/password sign-up; courses taken, schedule, clubs and spending saved per account.

## Run it

```bash
npm install
cp .env.example .env.local   # all settings optional, see comments inside
npm run dev                  # http://localhost:3000
```

Without a Gemini key Rhett still works using keyword rules ("add WR 153", "plan my week", "can I take EC 413?", "how's my budget?").

## Testing instructions

1. Open the live app. It starts as a demo Computer Engineering sophomore with freshman year completed.
2. **Plan:** search "PY 212", pick a lecture, a discussion and a lab, and watch the calendar; then add "MA 226" to see clash warnings.
3. Tap **Ask Rhett** on the Plan page: "Is there a morning WR 153 section? Add it."
4. **Home:** see "Leave by" for the next class; change "Starting from" to West Campus to see the Green Line option.
5. **Week:** paste a club email, tap "Find events", then "Plan my week" and download the .ics.
6. **Money:** check the budget pace, paste an order confirmation email, and compare delivery prices.

## Who owns what

| Person | Owns | Folders |
| --- | --- | --- |
| A (Claude Code) | Course data, planners, agent backend | `scripts/`, `data/`, `src/lib/`, `src/app/api/` |
| B (Kiro) | Polish screens: Home, Plan, Week, Food, Chat (first versions built) | `src/app/*/page.tsx`, `src/components/` |
| C (Kiro) | Google sign-in, Gmail (feeds `/api/extract-events` and `/api/expenses/extract`), Google Calendar | `src/lib/google/`, `src/app/api/google/` |
| D | Food dataset, research, pitch, Devpost | `data/food.json` (via C), `docs/` |

Work on a branch, open a PR, keep `main` deployable.

## Contracts

All shapes live in [`src/lib/types.ts`](src/lib/types.ts). Example data is in [`src/mocks/index.ts`](src/mocks/index.ts), so screens can be built before the real routes are done.

| Route / file | Returns | Status |
| --- | --- | --- |
| `GET /api/courses?q=logic` / `?code=ENG EC 311` | course search / one `Course` | live once `data/courses.json` is scraped |
| `GET /api/majors` / `?id=ce` | major list / one `Major` | live (CE) |
| `POST /api/plan/semester` | `SemesterPlanResponse` | live |
| `POST /api/plan/week` | `WeekPlanResponse` | live |
| `POST /api/week.ics` | `.ics` calendar file (same body as `/api/plan/week`) | live |
| `POST /api/chat` | `ChatResponse` (`reply` + `cards` to render) | live: Gemini if `GEMINI_API_KEY` is set, keyword rules otherwise |
| `POST /api/extract-events` | `ExtractResponse` from a club email or syllabus (text or PDF) | live: Gemini or rules |
| `GET /api/food` | `FoodQuote[]` | sample data until `data/food.json` exists |
| `POST /api/transit` | leave-by times per class: walk vs Green Line (live MBTA), NWS weather | live |
| `POST /api/expenses/extract` | `Expense[]` from a receipt photo or order email | live: Gemini or rules |
| `data/courses.json` | `Course[]` (all BU courses, prereqs, Fall 2026 / Spring 2027 sections) | scraping |
| `data/majors/<id>.json` | `Major` (program planning sheet) | CE first |

Times are minutes after midnight (`545` = 9:05 am). Days are `"Mon"`…`"Sun"`.

## Data sources and credits

- **BU course catalog** (bu.edu/academics, public course pages): courses, prerequisites, Hub areas and Fall 2026 sections, scraped politely by `scripts/scrape_bu_courses.py`.
- **BU Bulletin** program requirements for the major sheets in `data/majors/`.
- **MBTA V3 API** (api-v3.mbta.com) for live Green Line departures. Data provided by the MBTA; their terms apply.
- **National Weather Service API** (api.weather.gov), public domain.
- **OpenStreetMap / Nominatim** for building coordinates in `data/buildings.json`. © OpenStreetMap contributors, ODbL.
- **Google Gemini API** for Rhett and document extraction.
- Food delivery prices were collected by hand by our team; DoorDash, Uber Eats and Grubhub are trademarks of their owners and are not affiliated with this project.

## Course data

`python3 scripts/scrape_bu_courses.py` scrapes every college's course pages on bu.edu/academics into `data/courses.json`. Pages are cached in `scripts/.cache/`, so reruns are fast.
