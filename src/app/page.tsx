"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RouteCard } from "@/components/RouteCard";
import { Card } from "@/components/ui";
import { EventRow } from "@/components/views";
import { DEFAULT_PREFS } from "@/lib/demo";
import { postSemesterPlan, postWeekPlan } from "@/lib/api";
import { classEvents } from "@/lib/planner/week";
import { useProfile } from "@/lib/profile";
import { mockWeekPlan } from "@/mocks/index";
import type { WeekEvent } from "@/lib/types";
import { DAYS } from "@/lib/types";
import type { Day } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickActionTile {
  href: string;
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TILES: QuickActionTile[] = [
  { href: "/plan", title: "Plan registration", body: "Next semester from your major sheet" },
  { href: "/week", title: "Plan my week", body: "Classes, clubs, study, gym and sleep" },
  { href: "/food", title: "Food", body: "Compare food delivery prices" },
  { href: "/chat", title: "Ask Rhett", body: "Your AI assistant for BU life" },
];

// ---------------------------------------------------------------------------
// HomeSchedulePreview â€” inline private component
// ---------------------------------------------------------------------------

function HomeSchedulePreview({
  today,
  error,
  currentMinutes,
}: {
  today: WeekEvent[] | null;
  error: string | null;
  currentMinutes: number;
}) {
  if (today === null) {
    return (
      <p role="status" aria-live="polite" className="text-sm text-zinc-400">
        Planning your dayâ€¦
      </p>
    );
  }

  if (error !== null) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-sm"
      >
        {error}
      </div>
    );
  }

  const upcoming = today
    .filter((e) => e.end > currentMinutes && e.kind !== "sleep")
    .sort((a, b) => a.start - b.start);

  if (upcoming.length === 0) {
    return (
      <Card className="text-sm text-zinc-500">Nothing else today. Enjoy the evening.</Card>
    );
  }

  return (
    <ul className="space-y-1.5">
      {upcoming.slice(0, 5).map((e) => (
        <EventRow key={e.id} e={e} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// QuickActionGrid â€” inline private component
// ---------------------------------------------------------------------------

function QuickActionGrid({ tiles }: { tiles: QuickActionTile[] }) {
  return (
    <section className="grid grid-cols-2 gap-3">
      {tiles.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-bu"
        >
          <p className="font-semibold">{t.title}</p>
          <p className="mt-1 text-xs text-zinc-500">{t.body}</p>
        </Link>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export default function Home() {
  const { profile, update } = useProfile();
  const router = useRouter();
  const askRef = useRef<HTMLInputElement>(null);
  const [week, setWeek] = useState<WeekEvent[]>([]);
  const [today, setToday] = useState<WeekEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState("");

  const day: Day = DAYS[(new Date().getDay() + 6) % 7];
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  useEffect(() => {
    (async () => {
      try {
        // Mock bypass â€” skip all API calls and use mock data directly
        if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
          const plan = mockWeekPlan;
          setWeek(plan.events);
          setToday(plan.events.filter((e) => e.day === day && e.kind !== "sleep"));
          return;
        }

        // Fetch semester plan if not already in profile
        let semesterCourses = profile.semester?.courses ?? [];
        if (!profile.semester) {
          const semesterPlan = await postSemesterPlan({
            majorId: profile.majorId,
            term: profile.term,
            standing: profile.standing,
            completed: profile.completed,
          });
          semesterCourses = semesterPlan.courses;
        }

        // Fetch week plan
        const plan = await postWeekPlan({
          weekOf: "",
          fixed: [...classEvents(semesterCourses), ...(profile.clubs ?? [])],
          prefs: profile.prefs ?? DEFAULT_PREFS,
        });

        setWeek(plan.events);
        setToday(plan.events.filter((e) => e.day === day && e.kind !== "sleep"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setError(msg);
      } finally {
        // Ensure today is never left as null (loading) after error
        setToday((prev) => (prev === null ? [] : prev));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAskSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ask.trim()) {
      router.push(`/chat?q=${encodeURIComponent(ask.trim())}`);
    } else {
      askRef.current?.focus();
    }
  };

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-sm text-zinc-500">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="text-2xl font-bold">Hi {profile.name ?? "Terrier"} ðŸ‘‹</h1>
      </div>

      {/* Ask Rhett quick-search bar */}
      <form
        onSubmit={handleAskSubmit}
        className="flex gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm"
      >
        <input
          ref={askRef}
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          placeholder='Ask Rhett: "Can I take EC 413?"'
          aria-label="Ask Rhett a question"
          className="min-w-0 flex-1 px-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-bu px-4 py-2 text-sm font-semibold text-white"
        >
          Ask
        </button>
      </form>

      {/* Getting to class */}
      <section>
        <h2 className="mb-2 font-semibold">Getting to class</h2>
        <RouteCard
          events={week}
          home={profile.home ?? "WARREN"}
          onHomeChange={(home) => update({ home })}
        />
      </section>

      {/* Rest of today */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Rest of today</h2>
          <Link href="/week" className="text-xs font-medium text-bu">
            Full week â†’
          </Link>
        </div>
        <HomeSchedulePreview
          today={today}
          error={error}
          currentMinutes={currentMinutes}
        />
      </section>

      {/* Quick-action tiles */}
      <QuickActionGrid tiles={TILES} />
    </div>
  );
}
