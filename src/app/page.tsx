"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteCard } from "@/components/RouteCard";
import { StudyCard } from "@/components/StudyCard";
import { IconCalendar, IconChevronRight, IconFood, IconLayers, IconSparkle, IconSun, IconWallet } from "@/components/icons";
import { Card, EmptyState, SectionHeader, Skeleton } from "@/components/ui";
import { postSemesterPlan, postWeekPlan } from "@/lib/api";
import { DEFAULT_BUDGET, DEFAULT_PREFS } from "@/lib/demo";
import { fmtTime } from "@/lib/format";
import { classEvents } from "@/lib/planner/week";
import { useProfile } from "@/lib/profile";
import { examEvents, mondayOf, shortCourse, studyFocus, studyPriorities } from "@/lib/study";
import type { Day, SemesterPlanResponse, WeekEvent, WeekPlanResponse } from "@/lib/types";
import { DAYS } from "@/lib/types";

const BAR = ["bg-sky-600", "bg-violet-600", "bg-emerald-600", "bg-amber-500", "bg-pink-600", "bg-teal-600"];

const NEXT = [
  { href: "/plan", Icon: IconLayers, title: "Plan my semester", body: "Pick sections, see clashes, add syllabi." },
  { href: "/week", Icon: IconCalendar, title: "View weekly schedule", body: "See how your week fits together." },
  { href: "/chat", Icon: IconSparkle, title: "Ask CampusWizard", body: "Find clarity on your next step." },
  { href: "/food", Icon: IconFood, title: "Explore food", body: "Dining halls open now, cheapest delivery." },
  { href: "/money", Icon: IconWallet, title: "Track spending", body: "Your semester budget, on pace." },
];

/** 45 -> "45-minute", 105 -> "1h 45m" */
const breakLength = (mins: number) => (mins < 60 ? `${mins}-minute` : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`);

function greeting(h: number) {
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { profile, update } = useProfile();
  const [week, setWeek] = useState<WeekEvent[]>([]);
  const [semester, setSemester] = useState<SemesterPlanResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nowDate = new Date();
  const day: Day = DAYS[(nowDate.getDay() + 6) % 7];
  const now = nowDate.getHours() * 60 + nowDate.getMinutes();

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const sem: SemesterPlanResponse =
          profile.semester ??
          (await postSemesterPlan({ majorId: profile.majorId, term: profile.term, standing: profile.standing, completed: profile.completed }));
        setSemester(sem);
        const plan: WeekPlanResponse = await postWeekPlan({
          weekOf: mondayOf(),
          fixed: [...classEvents(sem.courses ?? []), ...(profile.clubs ?? []), ...examEvents(profile.assignments ?? [], mondayOf())],
          prefs: profile.prefs ?? DEFAULT_PREFS,
          focus: studyFocus(profile.assignments ?? []),
        });
        setWeek(plan.events);
      } catch {
        setError("Couldn't load your day. Check your connection and try again in a moment.");
      }
      setLoaded(true);
    })();
  }, [profile]);

  // today's fixed commitments (classes, club meetings, exams), in time order
  const courses = semester?.courses ?? [];
  const today = week.filter((e) => e.day === day && (e.kind === "class" || e.kind === "club" || e.kind === "exam")).sort((a, b) => a.start - b.start);
  const nextIdx = today.findIndex((e) => e.end > now);
  const courseIndex = (title: string) => Math.max(0, courses.findIndex((c) => title.startsWith(shortCourse(c.code))));
  const courseTitle = (title: string) => courses.find((c) => title.startsWith(shortCourse(c.code)))?.title;

  // longest gap between today's commitments (for the break line and the AI suggestion)
  let gap: { from: number; to: number } | null = null;
  for (let i = 1; i < today.length; i++) {
    const g = { from: today[i - 1].end, to: today[i].start };
    if (g.to - g.from >= 45 && (!gap || g.to - g.from > gap.to - gap.from)) gap = g;
  }
  const top = studyPriorities(profile.assignments ?? [])[0];
  const suggestion = top && top.daysLeft <= 5
    ? { text: `${shortCourse(top.assignment.courseCode)} ${top.assignment.title} is ${top.daysLeft === 0 ? "today" : top.daysLeft === 1 ? "tomorrow" : `in ${top.daysLeft} days`}. ${top.assignment.topics.length ? `Start with ${top.assignment.topics[0]}.` : "A focused hour today goes a long way."}`, ask: `Help me plan my study time for ${shortCourse(top.assignment.courseCode)} ${top.assignment.title}.` }
    : gap
      ? { text: `Keep your ${fmtTime(gap.from)}–${fmtTime(gap.to)} break open for lunch and a quick study session.`, ask: `I have a break from ${fmtTime(gap.from)} to ${fmtTime(gap.to)} today. How should I use it?` }
      : { text: "A quick look at the week ahead makes the busy days feel lighter.", ask: "What does my week look like, and what should I prioritize?" };

  // term progress
  const budget = profile.budget ?? DEFAULT_BUDGET;
  const start = new Date(`${budget.semesterStart}T00:00:00`).getTime(), end = new Date(`${budget.semesterEnd}T00:00:00`).getTime();
  const totalWeeks = Math.max(1, Math.ceil((end - start) / (7 * 86_400_000)));
  const weekNo = Math.min(totalWeeks, Math.max(1, Math.floor((nowDate.getTime() - start) / (7 * 86_400_000)) + 1));
  const units = courses.reduce((u, c) => u + c.units, 0);

  const first = (profile.name ?? "Terrier").split(" ")[0];

  return (
    <div className="space-y-4">
      <div className="cw-enter">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{greeting(nowDate.getHours())}, {first}</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          {nowDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · A clear plan makes room for a good day.
        </p>
      </div>

      <Card className="!p-5">
        <SectionHeader title="Today's schedule" href="/week" linkLabel="View week" />
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : !loaded ? (
          <Skeleton rows={3} label="Planning your day…" />
        ) : today.length === 0 ? (
          <EmptyState
            icon={<IconSun size={20} />}
            title="A little breathing room."
            body="There are no classes on today's schedule. Take a look at the week ahead."
            action={<Link href="/week" className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 px-3 text-sm font-semibold">View weekly schedule</Link>}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-zinc-500">
              {nowDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {today.length} {today.length === 1 ? "commitment" : "commitments"}
            </p>
            <ul className="space-y-2.5">
              {today.map((e, i) => {
                const next = i === nextIdx;
                const done = e.end <= now;
                return (
                  <li key={e.id} className={`flex gap-3 rounded-xl border p-3.5 transition-colors ${next ? "border-red-200 bg-red-50/70" : "border-zinc-200"} ${done ? "opacity-55" : ""}`}>
                    <span className={`w-1 shrink-0 rounded-full ${e.kind === "club" ? "bg-violet-500" : e.kind === "exam" ? "bg-bu" : BAR[courseIndex(e.title) % BAR.length]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">{courseTitle(e.title) ?? e.title}</span>
                        {next && <span className="text-[11px] font-semibold uppercase tracking-wide text-bu">{e.start <= now ? "Now" : "Up next"}</span>}
                      </span>
                      <span className="mt-0.5 block text-sm text-zinc-500">{fmtTime(e.start)} – {fmtTime(e.end)}</span>
                      <span className="block text-sm text-zinc-500">{[courseTitle(e.title) ? e.title : null, e.location].filter(Boolean).join(" · ")}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {gap && <p className="mt-3 text-sm text-zinc-500">You have a {breakLength(gap.to - gap.from)} break at {fmtTime(gap.from)}.</p>}
          </>
        )}
      </Card>

      <RouteCard events={week} home={profile.home ?? "WARREN"} onHomeChange={(home) => update({ home })} />

      <Card className="!p-5">
        <h2 className="text-[17px] font-semibold">{profile.term}</h2>
        <p className="mt-1 text-sm text-zinc-500">{weekNo <= totalWeeks / 2 ? "A steady start to the semester." : "A steady start to the second half."}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[[String(units || "–"), "Credits"], [String(courses.length || "–"), "Courses"], [`${weekNo} / ${totalWeeks}`, "Week"]].map(([n, l]) => (
            <div key={l}><p className="text-2xl font-bold tracking-tight">{n}</p><p className="text-xs text-zinc-500">{l}</p></div>
          ))}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={weekNo} aria-valuemin={1} aria-valuemax={totalWeeks} aria-label="Semester progress">
          <div className="h-full rounded-full bg-bu transition-all duration-500" style={{ width: `${(weekNo / totalWeeks) * 100}%` }} />
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          {new Date(`${budget.semesterStart}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })} – {new Date(`${budget.semesterEnd}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          {!profile.semester && " · Suggested schedule"}
        </p>
      </Card>

      <Card className="!p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-bu"><IconSparkle size={17} /> A little planning goes a long way</p>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-800">{suggestion.text}</p>
        <Link href={`/chat?q=${encodeURIComponent(suggestion.ask)}`} className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold hover:bg-zinc-50">
          Think it through with AI
        </Link>
        <p className="mt-2 text-xs text-zinc-400">Suggestion based on your schedule{profile.assignments?.length ? " and syllabi" : ""}.</p>
      </Card>

      <section id="coming-up" className="scroll-mt-20">
        <SectionHeader title="Coming up" href="/plan" linkLabel="All deadlines" className="px-1" />
        <StudyCard assignments={profile.assignments ?? []} />
      </section>

      <section>
        <SectionHeader title="What's next?" className="px-1" />
        <div className="space-y-2.5">
          {NEXT.map(({ href, Icon, title, body }) => (
            <Link key={href} href={href} className="group flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200 hover:border-red-200 hover:bg-red-50/40">
              <span className="text-bu"><Icon size={22} /></span>
              <span className="flex-1"><p className="font-semibold">{title}</p><p className="text-sm text-zinc-500">{body}</p></span>
              <span className="text-zinc-300 transition-transform duration-200 group-hover:translate-x-0.5"><IconChevronRight size={18} /></span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
