# Rhett — your BU student assistant

DS+X 2026 (College track) × Hackachusetts 2026 (Civic Action, challenge V4: Better college experiences).

Rhett helps BU students plan registration around prerequisites and their major, plan their week around classes and clubs, and find the cheapest delivery app for the same order.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## Who owns what

| Person | Owns | Folders |
| --- | --- | --- |
| A (Claude Code) | Course data, planners, agent backend | `scripts/`, `data/`, `src/lib/`, `src/app/api/` |
| B (Kiro) | Screens | `src/app/(screens)/`, `src/components/` |
| C (Kiro) | Google sign-in, Gmail, Calendar, food page, transit | `src/app/food/`, `src/lib/google/`, `src/app/api/transit/` |
| D | Food dataset, research, pitch, Devpost | `data/food.json` (via C), `docs/` |

Work on a branch, open a PR, keep `main` deployable.

## Contracts

All shapes live in [`src/lib/types.ts`](src/lib/types.ts). Example data is in [`src/mocks/index.ts`](src/mocks/index.ts), so screens can be built before the real routes are done.

| Route / file | Returns | Status |
| --- | --- | --- |
| `GET /api/courses?q=logic` / `?code=ENG EC 311` | course search / one `Course` | live once `data/courses.json` is scraped |
| `POST /api/plan/semester` | `SemesterPlanResponse` | mock |
| `POST /api/plan/week` | `WeekPlanResponse` | mock |
| `POST /api/chat` | `ChatResponse` | stub |
| `GET /api/food` | `FoodQuote[]` | sample data until `data/food.json` exists |
| `data/courses.json` | `Course[]` (all BU courses, prereqs, Fall 2026 / Spring 2027 sections) | scraping |
| `data/majors/<id>.json` | `Major` (program planning sheet) | CE first |

Times are minutes after midnight (`545` = 9:05 am). Days are `"Mon"`…`"Sun"`.

## Course data

`python3 scripts/scrape_bu_courses.py` scrapes every college's course pages on bu.edu/academics into `data/courses.json`. Pages are cached in `scripts/.cache/`, so reruns are fast.
