# Tech

## Stack

- **Next.js 15.5.28** (App Router, `src/` layout), **React 19**, **TypeScript**, **Tailwind CSS v4**.
  - Keep Next on a patched **15.5.x**. Vercel refuses to build vulnerable versions, which breaks the live demo.
- **No UI library.** Small primitives live in `src/components/ui.tsx`: `Card`, `Button`, `Pill`, `PageTitle`. Reuse these instead of adding a component library. BU red is the Tailwind color `bu` (`#cc0000`).
- **AI: Google Gemini REST API**, model `gemini-3.5-flash`. This is the only model the key can use — others return 404, so do not switch models. All calls go through `src/lib/agent/geminiFetch.ts`.
- **Account storage:** Redis on Vercel (`REDIS_URL`, TCP via the `redis` package) or Upstash REST; in development a local JSON file at `data/.local-db.json` (gitignored). All of this is behind `src/lib/store.ts` — go through it, don't talk to Redis directly.
- **External APIs:** MBTA V3 (live Green Line B), National Weather Service hourly forecast, Google Gemini. No keys needed except Gemini.

## Commands

| Command | Use |
| --- | --- |
| `npm run dev` | Local dev server at http://localhost:3000. Don't launch this from an agent (long-running); ask the user to run it. |
| `npx tsc --noEmit` | Type check. |
| `npx eslint src` | Lint. |
| `npm run build` | Production build (what Vercel runs). |

**Pre-push gate (required):** `npx tsc --noEmit && npx eslint src && npm run build`. All three must pass before any push to `main`, because `main` auto-deploys and is the live demo. A broken push breaks the demo.

## Environment variables

See `.env.example`. On Vercel these are set: `GEMINI_API_KEY` (billing enabled), `AUTH_SECRET`, `REDIS_URL`. **Never commit `.env.local` and never print keys** (reference them by name, not value). Without a Gemini key the app still works through the keyword rules fallback.

## Conventions this repo already follows

- **Shared contracts live in `src/lib/types.ts`.** Screens, API routes and the agent all depend on them. Change them only with care and tell the team; a shape change ripples everywhere. See `structure.md` for the field-level contract.
- **Server-only modules.** `transit.ts` and the data loaders run server-side only; import `server-only` where appropriate and don't pull them into client components.
- **Profile state ownership.** A component that changes the profile receives `profile` and `update` from its page. There is **one `useProfile()` per page** — a second `useProfile()` in a child would hold separate, diverging state (see `src/lib/profile.ts`).
- **React effects must not return a value.** Write `useEffect(() => { el?.scrollIntoView(); }, [...])` with braces. Chrome's `scrollIntoView` returns a Promise, and returning it from an effect is treated as a (wrong) cleanup function.
- **Remount pickers on identity change.** When a `SectionPicker` opens for a different course it must remount via `key={course.code}` so a previous course's picks never carry over.
- **Agent resilience.** Every Gemini path has a `src/lib/agent/rules.ts` fallback; 503s retry with backoff and a quota 429 pauses Gemini for ≤10 minutes. Preserve this when touching the agent.

## Testing (being added via Kiro)

- Test runner: **Vitest + fast-check** for property-based tests (task T2), targeting `src/lib/sections.ts` and `src/lib/schedule.ts`, run against both generated sections and real `data/courses.json` entries.
- Agent hooks (task T3) run `npx tsc --noEmit` and `npx eslint` on save of `src/**/*.ts(x)`, and validate `data/majors/*.json` against the `Major` type on change.
- Keep Kiro artifacts (steering, specs, hooks, tests) committed under `.kiro/` — their presence is part of the submission.

## Data & scraping notes

- `data/courses.json` (~8 MB, 7,620 courses) is built by `scripts/scrape_bu_courses.py`. **BU rate-limits: it returned 403 at 10 parallel requests. Use `--workers 2 --delay 1.5`, or `--offline` to rebuild from the `scripts/.cache/` pages.**
- `data/food.json` does not exist yet; `/api/food` serves sample data (restaurant names start with `SAMPLE`) until it's added. The sample banner disappears automatically once the file exists.
