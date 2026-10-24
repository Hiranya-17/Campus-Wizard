# Requirements Document

## Introduction

Rhett is a Boston University student assistant Progressive Web App built with Next.js 15, TypeScript, and Tailwind 4. This document covers all frontend requirements for Person B's scope: the Home dashboard, Registration Planner, AI Week Planner, Chat interface, Food placeholder, Bottom Navigation, mobile-first UX, mock data usage, and the web app manifest. Backend API routes, authentication flows, and the Food comparison page (Person C) are explicitly out of scope.

The app runs at `max-w-md` width centered in a BU red header + bottom-nav shell. All screens share the `Card`, `Button`, `Pill`, and `PageTitle` primitives from `ui.tsx`, and consume typed contracts from `types.ts` without introducing new `any` types.

## Glossary

- **App**: The Rhett Next.js PWA.
- **BottomNav**: The fixed five-tab navigation bar rendered in `src/components/BottomNav.tsx`.
- **BU Red**: The brand color `#cc0000`, available as the Tailwind utility `bg-bu` / `text-bu`.
- **Dashboard**: The Home page at route `/`.
- **Demo_Profile**: The `DEMO_PROFILE` object from `src/lib/demo.ts`; used as the initial profile state for guest sessions.
- **EventRow**: The `EventRow` component from `src/components/views.tsx` that renders a single `WeekEvent` as a color-coded list item.
- **Minutes**: Integer minutes after midnight (e.g. 9:05 am = 545), as defined in `types.ts`.
- **Mock_Data**: The exports `mockSemesterPlan`, `mockWeekPlan`, and `sampleFood` from `src/mocks/index.ts`.
- **Profile**: The `Profile` interface from `types.ts`; persisted in `localStorage` for guests and synced to the server for logged-in users via `useProfile()`.
- **RouteCard**: The `RouteCard` component from `src/components/RouteCard.tsx` that shows transit/walk legs to the next class.
- **SemesterView**: The `SemesterView` component from `src/components/views.tsx` that renders a class-grid timetable and per-course cards.
- **useProfile**: The React hook from `src/lib/profile.ts` that returns `{ profile, update, reset, user, ready }`.
- **WeekView**: The `WeekView` component from `src/components/views.tsx` that renders a 7-day tab bar and per-day event list.
- **WCAG_AA**: Web Content Accessibility Guidelines 2.1 Level AA contrast ratio requirements (4.5:1 for normal text, 3:1 for large text).

---

## Requirements

### Requirement 1: Home Dashboard

**User Story:** As a BU student, I want a personalized home screen that shows today's schedule, a quick-ask bar, and links to all main features, so that I can see what matters right now without navigating away.

#### Acceptance Criteria

1. THE Dashboard SHALL display the student's name from `profile.name` (falling back to `"Terrier"` when the name is absent) in a greeting heading alongside today's date formatted as weekday, month, and day.
2. WHEN the user submits the "Ask Rhett" form with a non-empty, non-whitespace query, THE Dashboard SHALL navigate to `/chat?q=<url-encoded-query>` using the Next.js router.
3. WHEN the "Ask Rhett" form is submitted with an empty or whitespace-only string, THE Dashboard SHALL prevent navigation and keep focus on the input.
4. THE Dashboard SHALL render a `RouteCard` component, passing the current `profile.clubs` and `profile.semester` events alongside `profile.home`, and calling `update({ home })` when the user changes the starting location.
5. THE Dashboard SHALL display a "Rest of today" section that shows up to 5 upcoming `WeekEvent` items for the current calendar day whose `end` time is after the current time, sorted ascending by `start` time, rendered using `EventRow`.
6. WHILE the week plan is being fetched on mount, THE Dashboard SHALL display a loading placeholder text instead of the event list.
7. WHEN no upcoming events remain for the current day, THE Dashboard SHALL display a `Card` with an empty-state message.
8. THE Dashboard SHALL render four quick-action tiles in a two-column grid linking to `/plan`, `/week`, `/money`, and `/chat`, each with a title and a body description of no more than 60 characters.
9. WHEN `profile.semester` is absent on mount, THE Dashboard SHALL POST to `/api/plan/semester` with `{ majorId, term, standing, completed }` from the current `Profile`, then POST to `/api/plan/week` to hydrate the "Rest of today" section.
10. WHEN `profile.semester` is present on mount, THE Dashboard SHALL skip the semester fetch and POST directly to `/api/plan/week` using `classEvents(profile.semester.courses)` combined with `profile.clubs`.
11. WHERE `NEXT_PUBLIC_USE_MOCKS` is set to `"true"`, THE Dashboard SHALL use `mockWeekPlan` from `src/mocks/index.ts` instead of calling the API.
12. IF either the `/api/plan/semester` or `/api/plan/week` POST fails on mount, THE Dashboard SHALL hide the loading state and display an error message in the "Rest of today" section without navigating away.

---

### Requirement 2: Registration Planner

**User Story:** As a BU student, I want to select my major, mark completed courses, and generate a conflict-free semester plan, so that I can register for the right courses without manually checking prerequisites.

#### Acceptance Criteria

1. THE Registration_Planner SHALL render a `<select>` populated from `GET /api/majors`, displaying each major's `name` with its `id` as the value, and persisting the choice to `profile.majorId` via `update()`.
2. THE Registration_Planner SHALL render a term `<select>` (options: `"Spring 2027"`, `"Fall 2027"`) and a standing `<select>` (`"freshman"`, `"sophomore"`, `"junior"`, `"senior"`), persisting changes to `profile.term` and `profile.standing` respectively.
3. WHEN a major is selected and the major detail is successfully returned from `GET /api/majors?id=<majorId>`, THE Registration_Planner SHALL render the major's plan terms as section headers, with each required course code as a toggleable pill button.
4. WHEN a course pill is in the completed state, THE Registration_Planner SHALL render it with `bg-bu text-white` styling; WHEN it is not completed, THE Registration_Planner SHALL render it with outlined `border-zinc-300 bg-white text-zinc-700` styling.
5. WHEN a pill button is tapped, THE Registration_Planner SHALL toggle the course code in `profile.completed` via `update()`.
6. WHEN the user types a query of 3 or more characters into the course search input after a 250 ms debounce, THE Registration_Planner SHALL call `GET /api/courses?q=<query>` and display a dropdown of up to 10 matching `{ code, title }` results; IF no results are returned, THE Registration_Planner SHALL display a "No courses found" message in the dropdown.
7. WHEN a course is selected from the search dropdown, THE Registration_Planner SHALL add the code to `profile.completed`, clear the search input, and close the dropdown.
8. WHEN the "Build my plan" button is clicked, THE Registration_Planner SHALL POST `{ majorId, term, standing, completed }` to `/api/plan/semester` and render the response using `SemesterView`.
9. WHILE the semester plan is being fetched, THE Registration_Planner SHALL disable the "Build my plan" button and display a loading label.
10. IF the POST to `/api/plan/semester` fails, THE Registration_Planner SHALL re-enable the "Build my plan" button, display an error message, and preserve all form state without clearing completed courses.
11. WHEN the `SemesterPlanResponse` contains a non-empty `blocked` array, THE Registration_Planner SHALL render a "Not yet" `Card` listing each blocked course's `code`, `title`, and missing prerequisite codes.
12. WHEN the `SemesterPlanResponse` contains a non-empty `warnings` array, THE Registration_Planner SHALL render each warning string as an amber-tinted callout.
13. THE Registration_Planner SHALL render a "Use this as my semester" `Button` below `SemesterView` that saves the current plan to `profile.semester` via `update()`.
14. WHEN the displayed plan equals `profile.semester`, THE "Use this as my semester" button SHALL display the confirmed label `"Saved as my semester ✓"`.
15. WHERE `NEXT_PUBLIC_USE_MOCKS` is set to `"true"`, THE Registration_Planner SHALL render `mockSemesterPlan` from `src/mocks/index.ts` without calling the API.

---

### Requirement 3: AI Week Planner

**User Story:** As a BU student, I want to tell Rhett my preferences and get a complete weekly schedule that fits around my classes and clubs, so that I never forget to block time for sleep, meals, studying, and the gym.

#### Acceptance Criteria

1. THE Week_Planner SHALL render a "Fixed this week" `Card` showing a list of events from `profile.clubs`, each displaying the event `kind` as a `Pill`, the `title`, and the `day` + formatted `start` time.
2. WHEN the remove button (✕) for a club event is tapped, THE Week_Planner SHALL remove that event from `profile.clubs` via `update()`.
3. THE Week_Planner SHALL render a `<textarea>` (maximum 20,000 characters) for pasting club newsletters or syllabuses, and a "Find events" `Button` that POSTs `{ kind, text }` to `/api/extract-events` where `kind` is `"syllabus"` when the pasted text matches `/syllabus|midterm|exam|homework/i`, otherwise `"email"`.
4. WHILE the extract request is in-flight, THE Week_Planner SHALL disable the "Find events" button and display a loading label.
5. WHEN the extract response contains events with a non-null `weekday` and non-null `start`, THE Week_Planner SHALL display each such event with an "Add weekly" button that appends a `WeekEvent` to `profile.clubs` via `update()`; events with a null `weekday` or null `start` SHALL be silently excluded from the displayed list.
6. IF the extract request fails or the response contains no events with a non-null `weekday` and `start`, THE Week_Planner SHALL re-enable the "Find events" button and display an error or empty-state message.
7. THE Week_Planner SHALL render a preferences form with inputs for: wake time (time input), sleep hours (number, step 0.5, range 0.5–24), study hours per day (number, step 0.5, range 0.5–24), gym days per week (number, range 0–7), and gym duration in minutes (number, step 15, range 15–240).
8. WHEN any preference input changes, THE Week_Planner SHALL persist the updated value to `profile.prefs` via `update()`, merging with existing preferences.
9. THE Week_Planner SHALL render a weekly to-do list showing each task from `profile.prefs.tasks` with its name, minutes, and frequency, and a remove (✕) button that deletes the task via `update()`.
10. THE Week_Planner SHALL render an add-task row with a task name input (max 100 characters), a duration input (1–480 minutes), a frequency input (1–7 times per week), and a "+" button that, when the name is non-empty, appends the task to `profile.prefs.tasks` via `update()`.
11. WHEN the "Plan my week" button is clicked, THE Week_Planner SHALL assemble a `WeekPlanRequest` and POST it to `/api/plan/week`, then render the response with `WeekView`.
12. WHEN assembling the `WeekPlanRequest` and `profile.semester` is absent, THE Week_Planner SHALL first POST to `/api/plan/semester` to obtain a semester plan, then use `classEvents()` to derive fixed class events for the week request.
13. IF the POST to `/api/plan/week` fails, THE Week_Planner SHALL re-enable the "Plan my week" button and display an error message.
14. WHEN the `WeekPlanResponse` contains a non-empty `unscheduled` array, THE Week_Planner SHALL display an amber callout listing the unscheduled item names.
15. THE Week_Planner SHALL render a "Add to Google / Apple Calendar (.ics)" secondary `Button` that POSTs the same `WeekPlanRequest` to `/api/week.ics` and triggers a browser download of the returned blob with a filename of the form `rhett-week-<YYYY-MM-DD>.ics`.
16. IF the `.ics` download request fails, THE Week_Planner SHALL display an error message without disrupting the currently displayed week plan.
17. WHERE `NEXT_PUBLIC_USE_MOCKS` is set to `"true"`, THE Week_Planner SHALL render `mockWeekPlan` from `src/mocks/index.ts` without calling the API.

---

### Requirement 4: Chat Interface

**User Story:** As a BU student, I want a conversational interface where I can ask Rhett anything about registration, my week, or food costs and get a structured answer, so that I can get help without filling out multiple forms.

#### Acceptance Criteria

1. WHEN the chat message history is empty, THE Chat_Interface SHALL render an empty state with a heading "Ask Rhett", a subtitle of no more than 100 characters, and a row of 6 suggestion chip buttons.
2. WHEN a suggestion chip is clicked, THE Chat_Interface SHALL populate the message input and send the message immediately without requiring a second action.
3. THE Chat_Interface SHALL render user messages as right-aligned bubbles with `bg-bu text-white` styling and assistant messages as left-aligned white `Card` elements.
4. WHEN the user submits a message, THE Chat_Interface SHALL append the user turn to the message list, POST `{ messages, profile }` to `/api/chat`, display a "Rhett is thinking…" indicator until the response arrives, and treat the request as failed if no response is received within 30 seconds.
5. WHEN the API response includes a non-empty `cards` array, THE Chat_Interface SHALL render each card directly below the assistant's text reply using the appropriate view component: `SemesterView` for `"semester"` cards, `WeekView` for `"week"` cards, `FoodView` for `"food"` cards, `BudgetView` for `"budget"` cards, and `CourseView` for `"course"` cards.
6. WHEN the API response includes an `"expense"` card, THE Chat_Interface SHALL render a green confirmation pill showing the amount and merchant, and append the expense to `profile.expenses` via `update()`.
7. WHEN the API response includes a `"semester"` card and `profile.semester` is not yet set, THE Chat_Interface SHALL save the plan to `profile.semester` via `update()`.
8. IF the `/api/chat` fetch fails or the request exceeds 30 seconds without a response, THEN THE Chat_Interface SHALL append an assistant message indicating the server could not be reached and restore the send button to its enabled state.
9. WHILE the user is composing a message, THE Chat_Interface SHALL render a message input bar that accepts at most 500 characters, remains sticky above the bottom navigation, and disables the send button when `busy` is true or the input is empty.
10. WHEN the URL contains a `?q=` query parameter on initial mount, THE Chat_Interface SHALL auto-send that value as the first user message exactly once.
11. WHEN a new turn is appended to the conversation, THE Chat_Interface SHALL scroll the conversation to the bottom.

---

### Requirement 5: Food Placeholder

**User Story:** As a developer maintaining the shared codebase, I want a dedicated `/food` route that Person C can develop independently, so that the navigation link resolves without a 404 until the full Food page is ready.

#### Acceptance Criteria

1. THE App SHALL expose a route at `/food` that renders without a runtime error.
2. THE Food_Placeholder page file SHALL be a separate file from `src/app/food/page.tsx`; if `src/app/food/page.tsx` already exists and is owned by Person C, THE Food_Placeholder SHALL leave that file unmodified.
3. THE Food_Placeholder SHALL NOT contain any food comparison logic, API calls, or layout content beyond what is minimally required to render the route.

---

### Requirement 6: Bottom Navigation

**User Story:** As a student using the app on mobile, I want a persistent bottom navigation bar with clearly labeled tabs, so that I can switch between all main sections with a single tap.

#### Acceptance Criteria

1. THE BottomNav SHALL render exactly five tabs in order: Home (`/`), Plan (`/plan`), Week (`/week`), Food (`/food`), and Chat (`/chat`).
2. THE BottomNav tab for food SHALL be labeled "Food" and link to `/food`, replacing the current "Money" tab that links to `/money`.
3. WHEN the current pathname matches a tab's `href` (using prefix matching for non-root tabs, exact match for `/`), THE BottomNav SHALL apply `text-bu` to that tab and its icon.
4. WHEN the current pathname does not match a tab's `href`, THE BottomNav SHALL apply `text-zinc-500` to that tab.
5. THE BottomNav SHALL apply `pb-[env(safe-area-inset-bottom)]` to its inner list to prevent content from being obscured by the iOS home indicator.
6. THE BottomNav SHALL remain fixed to the bottom of the viewport on scroll using `fixed inset-x-0 bottom-0` positioning.
7. EACH tab link in THE BottomNav SHALL have a minimum tap target height of 44 px and SHALL include an `aria-label` on the SVG icon describing the destination.

---

### Requirement 7: Mobile-First UX and Accessibility

**User Story:** As a BU student using a phone, I want every screen to be easy to tap, readable, and keyboard-navigable, so that the app feels native and works for everyone.

#### Acceptance Criteria

1. THE App SHALL constrain all page content to a maximum width of `max-w-md` centered horizontally within the viewport.
2. THE App SHALL ensure all interactive elements (buttons, links, inputs, `<select>` elements) have a minimum touch target height of 44 px.
3. THE App SHALL provide an `aria-label` or visible label for every interactive element that does not have descriptive text content visible to sighted users.
4. THE App SHALL meet WCAG_AA contrast requirements: text rendered on BU Red (`#cc0000`) backgrounds SHALL use white (`#ffffff`), which achieves a contrast ratio above 4.5:1 for normal-weight text at the font sizes used.
5. THE App SHALL ensure all form inputs are associated with a `<label>` element or `aria-label` attribute.
6. THE App SHALL ensure that the DOM order of focusable elements on each screen follows a top-to-bottom, left-to-right reading sequence so that keyboard and screen-reader users can navigate predictably.
7. WHEN an interactive element is disabled, THE App SHALL set the HTML `disabled` attribute rather than only changing visual styling, so that assistive technologies announce the disabled state.

---

### Requirement 8: Mock Data and API Client Layer

**User Story:** As a frontend developer, I want typed fetch wrappers and mock data fallbacks, so that I can build and test all screens without depending on a running backend.

#### Acceptance Criteria

1. THE App SHALL export three typed API client functions from `src/lib/api.ts`:
   - `postSemesterPlan(req: SemesterPlanRequest): Promise<SemesterPlanResponse>` that POSTs to `/api/plan/semester`.
   - `postWeekPlan(req: WeekPlanRequest): Promise<WeekPlanResponse>` that POSTs to `/api/plan/week`.
   - `postChat(req: ChatRequest): Promise<ChatResponse>` that POSTs to `/api/chat`.
2. THE Api_Client functions SHALL set `Content-Type: application/json` on every request and parse the response body as JSON before returning.
3. IF an API client function receives a non-2xx HTTP response or a network error, IT SHALL throw a typed error that the calling component can catch and display to the user.
4. THE Api_Client module SHALL NOT use `any` types in its function signatures or internal implementation.
5. THE Api_Client module SHALL NOT introduce new npm dependencies; it SHALL use the browser-native `fetch` API.
6. WHERE `NEXT_PUBLIC_USE_MOCKS` is set to `"true"`, THE postSemesterPlan function SHALL resolve with `mockSemesterPlan` from `src/mocks/index.ts` without making a network request.
7. WHERE `NEXT_PUBLIC_USE_MOCKS` is set to `"true"`, THE postWeekPlan function SHALL resolve with `mockWeekPlan` from `src/mocks/index.ts` without making a network request.
8. WHERE `NEXT_PUBLIC_USE_MOCKS` is set to `"true"`, THE postChat function SHALL resolve with a stub `ChatResponse` without making a network request.

**API Contract Notes for Person A review** (contracts already defined in `types.ts` — flagged gaps are noted):

- `POST /api/plan/semester`: accepts `SemesterPlanRequest`, returns `SemesterPlanResponse`. No gaps identified; all fields are present in `types.ts`.
- `POST /api/plan/week`: accepts `WeekPlanRequest`, returns `WeekPlanResponse`. **Gap**: the `weekOf` field is typed as a required ISO date string, but `/src/app/page.tsx` currently passes an empty string `""` for this field. Person A should clarify whether the server accepts an empty string and substitutes the current week, or whether the client must always provide a valid date.
- `POST /api/chat`: accepts `ChatRequest`, returns `ChatResponse`. **Gap**: `ChatRequest.profile` is typed as `Profile | undefined`; it is unclear whether an absent profile causes the server to use a default context or return an error. Person A should document the behavior when `profile` is omitted.

---

### Requirement 9: Web App Manifest and Icon

**User Story:** As a student who installs Rhett on their phone, I want the PWA manifest to be correct so that the app installs with the right name, color, and icon.

#### Acceptance Criteria

1. THE Manifest SHALL set `"name"` to `"Rhett - BU student assistant"` and `"short_name"` to `"Rhett"`.
2. THE Manifest SHALL set `"theme_color"` to `"#cc0000"` and `"background_color"` to `"#f6f6f7"`.
3. THE Manifest SHALL include an `"icons"` array with at least one entry referencing `/icon.svg` with `"sizes": "any"` and `"type": "image/svg+xml"`.
4. THE Manifest SHALL set `"display"` to `"standalone"` and `"start_url"` to `"/"`.
5. THE App layout SHALL reference the manifest via the Next.js `metadata.manifest` field so that the browser receives the correct `<link rel="manifest">` tag.
6. THE App layout SHALL include `appleWebApp` metadata with `capable: true`, `title: "Rhett"`, and `statusBarStyle: "default"` to ensure iOS home-screen installs render correctly.
