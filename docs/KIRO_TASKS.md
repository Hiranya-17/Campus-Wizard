# Kiro task plan (Oct 24, from 2:45 pm)

Everything left before the Hackachusetts submission happens in Kiro. Each task below has an owner, a time box, the Kiro feature it shows judges, and a prompt to paste into Kiro. Background for Kiro is in `docs/KIRO_HANDOFF.md`; every prompt starts by pointing Kiro there.

## Timeline

| Time | You (A) | B | C | D |
| --- | --- | --- | --- | --- |
| 2:45–3:05 | **K1 Steering**, push | Pull; decide the name | Pull; Google Cloud OAuth setup | Share food sheet; start Kiro log |
| 3:05–3:25 | **K2 Hooks**, push | **K6 Rename** (if renaming), push | **K4 Gmail sync** spec | Interview notes, pitch deck |
| 3:25–4:40 | **K3 Property-based tests** | **K8 Voice assistant** | K4 build | Devpost text draft |
| 4:40–5:10 | **K5 Food data import** | **K7 Onboarding + polish** | K4 build (cut-off 5:15) | Demo script |
| 5:10–5:45 | Review, merge, check live site | K7 finish | K4 finish or fall back | Kiro write-up draft from the log |
| **5:45** | **Feature freeze: only fixes after this** | | | |
| 5:45–6:45 | Record the demo video on a phone (everyone) | | | |
| 6:45–7:30 | Finish write-up, upload video, submit by **7:30** | | | |

If you're behind at 5:15, drop K4 (the "Paste a club newsletter" box already works) and spend the time on the write-up.

## Rules for everyone

1. `git pull` before you start and before every push. You each own different files (listed per task), so conflicts should be rare.
2. Before every push: `npx tsc --noEmit && npx eslint src && npm run build`. Pushing to `main` updates the live app judges will use. Never push a failing build.
3. Commit the `.kiro/` folder (specs, steering, hooks). It is required for eligibility.
4. **Keep a Kiro log** in the team chat as you go, one line each: what you asked Kiro, which feature (spec, hook, steering, MCP, PBT), and what it caught or saved. D turns this into the write-up. Concrete moments ("the property test found…", "the hook blocked a push that…") are what judges want.
5. Don't break the guest demo (the app must work without logging in) or the rules in section 7 of the handoff.

---

## K1. Steering docs (You, 20 min) · Kiro feature: steering

Files: `.kiro/steering/*`

```
Read docs/KIRO_HANDOFF.md in full, then README.md and src/lib/types.ts.

Generate steering docs for this repo (product, tech, structure). Then refine them:
- tech: Next.js 15.5.x (keep it patched), React 19, TypeScript, Tailwind v4, Gemini REST via
  src/lib/agent/geminiFetch.ts, Redis via src/lib/store.ts; required checks before push:
  npx tsc --noEmit && npx eslint src && npm run build.
- structure: the file map in section 6 of the handoff.
- product: who it's for (BU students), the five areas (Plan, Week, Getting to class, Money, Rhett),
  and the Hackachusetts Civic Action V4 framing.
- Add a fourth steering doc "rules" containing the data-model conventions from section 4 (minutes after
  midnight, "Mon".."Sun", AND-of-ORs prereqs, completed = before the term, semester = chosen sections)
  and every hard-won rule from section 7, verbatim where possible.
Show me the docs before saving. Don't change any app code.
```

## K2. Agent hooks (You, 20 min) · Kiro feature: hooks

Files: `.kiro/hooks/*`

```
Using the steering docs, create two agent hooks:
1. On save of src/**/*.ts or src/**/*.tsx: run `npx tsc --noEmit` and `npx eslint <the saved file>` and
   report errors with the file and line, suggesting a fix.
2. On save of data/majors/*.json: check the file against the Major type in src/lib/types.ts, check that
   every course code in it exists in data/courses.json, and that every elective slot names a group defined
   in electiveGroups. Report anything wrong.
Then test both: introduce a deliberate type error in a scratch change and a bad course code in a copy of
data/majors/ce.json, confirm the hooks catch them, and revert.
```

## K3. Property-based tests for sections and schedules (You, 75 min) · Kiro features: spec + PBT

Files: `src/lib/*.test.ts`, `vitest.config.ts`, `package.json` (devDependencies and a `test` script only)

```
Create a spec named "schedule-correctness" (requirements -> design -> tasks) for property-based tests of
src/lib/sections.ts and src/lib/schedule.ts, using Vitest and fast-check. Read section 7.1 of
docs/KIRO_HANDOFF.md first: it describes how BU sections fit together and the real courses that broke
earlier versions (WR 153, MA 226, EC 311, PY 212, CS 111, CS 440, DS 320).

Requirements to turn into properties:
1. pickSections never returns two overlapping sections, and never overlaps the `taken` sections given.
2. Every sectionOptions option has at most one Discussion group and at most one Lab group.
3. All rows in a unit share one section id, and every section of a course appears in some option.
4. withoutCourse(withCourse(s, c), c.code) has the same course codes as s when c wasn't in s, and
   totalUnits always equals the sum of course units.
5. conflicts() is empty for any schedule built course by course with pickSections against the previous picks.
Use generated sections (random days and times, section ids with letters A-N and numbers 1-9) AND every
course in data/courses.json that has Fall 2026 sections.

Add `"test": "vitest run"` to package.json. Don't change app behavior unless a property fails; if one does,
stop and show me the counterexample before fixing anything.
```

## K4. Gmail club-email sync (C, until 5:15 cut-off) · Kiro features: spec + MCP

Files: `src/lib/google/*`, `src/app/api/google/*`, and the "Fixed this week" card in `src/app/week/page.tsx`

Before starting: in Google Cloud Console create an OAuth client (Web), consent screen in **Testing** mode, scope `gmail.readonly`, add all four of you as test users, redirect URI `https://ds-x-hackachusetts.vercel.app/api/google/callback` and `http://localhost:3000/api/google/callback`. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` and on Vercel. In Kiro, add an MCP server (for example a fetch or docs server) and use it to read the Gmail API docs while writing the spec.

```
Read docs/KIRO_HANDOFF.md, then create a spec "gmail-club-sync" for task T4:
- A "Connect Gmail" button on the Week page's "Fixed this week" card. OAuth 2.0 web flow with
  gmail.readonly; tokens stored server-side in the user's profile record via src/lib/store.ts
  (logged-in users only; guests keep using the paste box).
- "Scan club emails": search the last 14 days for newsletters (query like "category:updates OR list:
  OR from:terrier OR subject:(meeting OR newsletter)"), take the first 10, send each body to the existing
  POST /api/extract-events with kind "email", and show the found events in the same list the paste box
  uses, with "Add weekly".
- The feature must be invisible when GOOGLE_CLIENT_ID isn't set, and the paste box must keep working.
- Never log email contents or tokens.
Write requirements and design first and show me before tasks.
```

## K5. Real delivery prices (You, 30 min; D supplies the sheet) · Kiro feature: spec

Files: `scripts/import_food.ts`, `data/food.json`

Before starting: D shares the sheet as "Anyone with the link: Viewer" or downloads it to `data/food.csv`.

```
Create a small spec "food-data-import" for task T5 in docs/KIRO_HANDOFF.md: a script scripts/import_food.ts
that reads data/food.csv and writes data/food.json as FoodQuote[] (see src/lib/types.ts). Validate every row:
numbers parse, total equals subtotal + deliveryFee + serviceFee + smallOrderFee + tax within $0.05 (report
rows that don't), app is one of DoorDash / Uber Eats / Grubhub, and each restaurant has the same items
across apps. Print a summary of rows kept and rejected. Run it, show me the rejected rows, then commit
data/food.json.
```

## K6. Rename the app (B, 20 min, only if the team decides to) · Kiro feature: steering-guided refactor

Files: user-facing strings across `src/`, `public/manifest.webmanifest`, `public/icon.svg`, README

```
We're renaming the app from "Rhett" to "<NEW NAME>" because Rhett is BU's trademarked mascot. Change every
user-facing string (header, page titles, chat intro and suggestions, the assistant's name in the system
prompt in src/lib/agent/gemini.ts and replies in src/lib/agent/rules.ts, manifest, icon letter, README).
Don't rename code identifiers, files or the localStorage keys. Show me a list of every change before applying.
```

## K7. Onboarding and polish (B, until 5:45) · Kiro feature: spec

Files: `src/app/page.tsx`, `src/components/*` (not ScheduleCalendar/SectionPicker logic), `src/app/globals.css`

```
Read docs/KIRO_HANDOFF.md, then create a spec "onboarding-and-polish" (task T6):
1. A first-visit intro (3 short screens, skippable, remembered in localStorage): what the app does, that
   you're looking at a demo student, and "Create an account" vs "Explore the demo".
2. Loading skeletons for Home's "Getting to class" and "Rest of today", and for search results on Plan.
3. Accessibility pass: every input has a label, visible focus rings, buttons have accessible names,
   text contrast meets WCAG AA on the red header and pills.
4. Consistent empty states (Plan with no classes, Week before planning, Money with no expenses).
Keep the bottom navigation and all existing behavior. Show me requirements and design first.
```

## K8. Voice assistant: talk to Rhett, hear the answer (B, 75 min) · Kiro feature: spec

Files: `src/components/ChatPanel.tsx`, new `src/lib/voice.ts`. Nobody else edits these files today.

Uses the browser's built-in Web Speech API, so there's no new key or cost: speech recognition works in Chrome, Edge and Safari (including iPhone); speech synthesis works in every modern browser. Test on a real phone over HTTPS (the live site), because microphones need HTTPS.

```
Read docs/KIRO_HANDOFF.md, then create a spec "voice-assistant" for the chat panel
(src/components/ChatPanel.tsx), used on the Rhett tab and in the Plan page's Ask Rhett sheet:
1. A microphone button next to Send. Tap to talk: live transcript appears in the input as you speak;
   when you stop talking (or tap again) the message sends automatically. Use the Web Speech API
   (SpeechRecognition / webkitSpeechRecognition, lang en-US, interimResults on). Put the browser
   logic in a new src/lib/voice.ts.
2. When a message was spoken, read Rhett's reply aloud with speechSynthesis: strip markdown (**, bullets),
   don't read course section tables or card contents, cap at about 3 sentences, pick a natural English
   voice if available. A speaker toggle in the panel header turns spoken replies on/off (remembered in
   localStorage). Tapping the mic while Rhett is speaking stops the speech (barge-in).
3. Clear states: listening (pulsing mic), thinking, speaking; a visible error if the mic permission is
   denied; hide the mic button entirely where speech recognition isn't supported, and keep typing working.
4. Must not break existing behavior: cards, schedule updates from Rhett, the suggestions, typing.
Show me requirements and design before tasks. Test on a phone via the live site after pushing.
```

Stretch, only if time allows: a "Hey Rhett" hands-free mode that keeps listening after each reply until the user says "stop".

## After the submission (for DS+X, due 11 am Oct 25)

- T7 Google Calendar sync (push the planned week; .ics stays as the fallback).
- Spring 2027 sections once BU posts them: `python3 scripts/scrape_bu_courses.py --workers 2 --delay 1.5`.
- More majors via `scripts/build_eng_major.py` for other ENG programs.
