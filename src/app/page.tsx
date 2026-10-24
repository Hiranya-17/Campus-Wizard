"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RouteCard } from "@/components/RouteCard";
import { Card } from "@/components/ui";
import { EventRow } from "@/components/views";
import { DEFAULT_PREFS } from "@/lib/demo";
import { classEvents } from "@/lib/planner/week";
import { useProfile } from "@/lib/profile";
import type { Day, SemesterPlanResponse, WeekEvent, WeekPlanResponse } from "@/lib/types";
import { DAYS } from "@/lib/types";

const TILES = [
  { href: "/plan", title: "Plan registration", body: "Next semester from your major sheet and prereqs" },
  { href: "/week", title: "Plan my week", body: "Classes, clubs, study, gym and sleep" },
  { href: "/money", title: "Money", body: "Semester budget, receipts and cheapest delivery" },
  { href: "/chat", title: "Ask Rhett", body: "Your AI assistant for BU life" },
];

export default function Home() {
  const { profile, update } = useProfile();
  const router = useRouter();
  const [week, setWeek] = useState<WeekEvent[]>([]);
  const [today, setToday] = useState<WeekEvent[] | null>(null);
  const [ask, setAsk] = useState("");
  const day: Day = DAYS[(new Date().getDay() + 6) % 7];

  useEffect(() => {
    (async () => {
      let semester: SemesterPlanResponse | undefined = profile.semester;
      if (!semester) {
        const r = await fetch("/api/plan/semester", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ majorId: profile.majorId, term: profile.term, standing: profile.standing, completed: profile.completed }),
        });
        semester = await r.json();
      }
      const r = await fetch("/api/plan/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOf: "", fixed: [...classEvents(semester?.courses ?? []), ...(profile.clubs ?? [])], prefs: profile.prefs ?? DEFAULT_PREFS }),
      });
      const plan: WeekPlanResponse = await r.json();
      setWeek(plan.events);
      setToday(plan.events.filter((e) => e.day === day && e.kind !== "sleep"));
    })();
  }, [profile, day]);

  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = today?.filter((e) => e.end > now) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-zinc-500">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="text-2xl font-bold">Hi {profile.name ?? "Terrier"} 👋</h1>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (ask.trim()) router.push(`/chat?q=${encodeURIComponent(ask)}`); }} className="flex gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
        <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask Rhett: “Can I take EC 413?”" className="min-w-0 flex-1 px-2 text-sm outline-none" />
        <button className="rounded-xl bg-bu px-4 py-2 text-sm font-semibold text-white">Ask</button>
      </form>

      <section>
        <h2 className="mb-2 font-semibold">Getting to class</h2>
        <RouteCard events={week} home={profile.home ?? "WARREN"} onHomeChange={(home) => update({ home })} />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Rest of today</h2>
          <Link href="/week" className="text-xs font-medium text-bu">Full week →</Link>
        </div>
        {today === null ? (
          <p className="text-sm text-zinc-400">Planning your day…</p>
        ) : upcoming.length ? (
          <ul className="space-y-1.5">{upcoming.slice(0, 5).map((e) => <EventRow key={e.id} e={e} />)}</ul>
        ) : (
          <Card className="text-sm text-zinc-500">Nothing else today. Enjoy the evening.</Card>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-bu">
            <p className="font-semibold">{t.title}</p>
            <p className="mt-1 text-xs text-zinc-500">{t.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
