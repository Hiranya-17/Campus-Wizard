# Product

Rhett is a mobile-first web app that helps Boston University students handle the parts of college that are annoying to coordinate: registration, the weekly schedule, getting to class, and money. A single AI assistant ("Rhett") can see and act across all of it.

## Who it's for

BU undergraduates. The default experience is a demo Computer Engineering sophomore (freshman year completed) so judges and first-time visitors can use everything without creating an account.

## What it does

- **Build your schedule.** Search any of 7,620 BU courses, see every Fall 2026 section (professor, days, times, room), and watch clashes appear on a live weekly calendar before adding a class. Lectures, discussions and labs are grouped the way BU actually registers them. Missing prerequisites are flagged from the courses the student has taken.
- **Rhett, the AI assistant.** Gemini with tool calling, aware of the student's calendar: finds sections, adds/drops classes, fixes clashes, suggests a full schedule from the major's planning sheet, plans the week, checks the budget, answers commute questions.
- **Plan my week.** Fits sleep, meals, study, gym and to-dos around fixed events (classes, clubs, exams); reads club emails and syllabi for meetings, exams and deadlines; exports to Google/Apple Calendar via `.ics`.
- **Getting to class.** "Leave by" times for every class, walking vs. the Green Line B with live MBTA departures, National Weather Service forecast, reminders.
- **Money.** Semester budget by category with pace projection; log spending from a receipt photo or order email; compare the total cost of the same order across DoorDash, Uber Eats and Grubhub.
- **Accounts.** Email/password sign-up; courses taken, schedule, clubs and spending saved per account.

## Context: this is a hackathon submission

- Tracks: Hackachusetts 2026 Civic Action (challenge V4, "Better college experiences") and DS+X 2026 (College track).
- The project **must be built with Kiro**, and the repo **must contain a committed `.kiro/` folder at its root** (never gitignored). How well Kiro is used (specs, hooks, steering, MCP, property-based tests, powers) is a scored judging criterion. The initial backend and data pipeline were built with Claude Code; all remaining work happens in Kiro and the write-up discloses this honestly.
- Judges must be able to test the live app **without logging in**.

## Non-negotiable product rules

These protect the demo and keep the submission valid. Do not regress them.

- **The guest demo must always work without login.** Judges test this way. Guest data lives in `localStorage` under key `rhett.profile.v2`; bump the version if the demo profile changes shape.
- **Rhett must never break the demo.** Every Gemini call falls back to the keyword rules in `src/lib/agent/rules.ts`. 503s retry with backoff; a daily-quota 429 pauses Gemini for at most 10 minutes.
- **Never push a failing build to `main`.** Pushing to `main` auto-deploys to Vercel (~1 min) and that is the live demo judges use. Run `npx tsc --noEmit && npx eslint src && npm run build` before every push.
- **Respect data-source terms.** Don't scrape DoorDash/Uber Eats/Grubhub — delivery prices are hand-collected. Don't fake BU shuttle times (no public feed exists); link to Terrier Transit instead. Keep required attributions (MBTA, NWS, OpenStreetMap/Nominatim) in the README.
- The name "Rhett" is BU's trademarked mascot; a rename may happen before the demo video. Don't hard-code the name in ways that are painful to change.
