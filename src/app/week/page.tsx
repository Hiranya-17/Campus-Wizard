"use client";
import { useState } from "react";
import { Button, Card, PageTitle, Pill } from "@/components/ui";
import { WeekView } from "@/components/views";
import { DEFAULT_PREFS } from "@/lib/demo";
import { fmtTime, fromInputTime, toInputTime } from "@/lib/format";
import { classEvents } from "@/lib/planner/week";
import { useProfile } from "@/lib/profile";
import type { ExtractResponse, ExtractedEvent, WeekEvent, WeekPlanRequest, WeekPlanResponse, WeekPrefs } from "@/lib/types";

function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="text-sm">
      <span className="text-xs text-zinc-500">{label}</span>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-zinc-300 p-2" />
    </label>
  );
}

export default function WeekPage() {
  const { profile, update } = useProfile();
  const prefs = profile.prefs ?? DEFAULT_PREFS;
  const setPrefs = (patch: Partial<WeekPrefs>) => update({ prefs: { ...prefs, ...patch } });
  const [plan, setPlan] = useState<WeekPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [paste, setPaste] = useState("");
  const [found, setFound] = useState<ExtractedEvent[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [task, setTask] = useState({ name: "", minutes: 30, timesPerWeek: 1 });

  const request = async (): Promise<WeekPlanRequest> => {
    let semester = profile.semester;
    if (!semester) {
      const res = await fetch("/api/plan/semester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ majorId: profile.majorId, term: profile.term, standing: profile.standing, completed: profile.completed }),
      });
      semester = await res.json();
    }
    return { weekOf: nextMonday(), fixed: [...classEvents(semester?.courses ?? []), ...(profile.clubs ?? [])], prefs };
  };

  const build = async () => {
    setLoading(true);
    const res = await fetch("/api/plan/week", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await request()) });
    setPlan(await res.json());
    setLoading(false);
  };

  const downloadIcs = async () => {
    const res = await fetch("/api/week.ics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await request()) });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: `rhett-week-${nextMonday()}.ics` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const extract = async () => {
    setExtracting(true);
    const res = await fetch("/api/extract-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: /syllabus|midterm|exam|homework/i.test(paste) ? "syllabus" : "email", text: paste }),
    });
    const data: ExtractResponse = await res.json();
    setFound(data.events);
    setExtracting(false);
  };

  const addClub = (e: ExtractedEvent) => {
    if (!e.weekday || e.start == null) return;
    const ev: WeekEvent = {
      id: `club-${Date.now()}`, title: e.title.slice(0, 40), day: e.weekday, start: e.start,
      end: e.end ?? e.start + 60, kind: e.kind === "exam" ? "exam" : "club", location: e.location ?? undefined, fixed: true,
    };
    update({ clubs: [...(profile.clubs ?? []), ev] });
    setFound(found.filter((f) => f !== e));
  };

  const classes = profile.semester?.courses.length ?? 0;

  return (
    <div className="space-y-4">
      <PageTitle title="Plan my week" subtitle="Rhett fits sleep, meals, study, gym and your to-dos around classes and clubs." />

      <Card className="text-sm">
        <p className="font-semibold">Fixed this week</p>
        <p className="mt-1 text-xs text-zinc-500">
          {classes ? `${classes} courses from your saved semester plan` : "No saved semester yet. Rhett will use your suggested plan."}
        </p>
        <ul className="mt-2 space-y-1">
          {(profile.clubs ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-xs">
              <Pill tone="red">{c.kind}</Pill>
              <span className="font-medium">{c.title}</span>
              <span className="text-zinc-500">{c.day} {fmtTime(c.start)}</span>
              <button className="ml-auto text-zinc-400" onClick={() => update({ clubs: profile.clubs!.filter((x) => x.id !== c.id) })}>✕</button>
            </li>
          ))}
        </ul>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={3}
          placeholder="Paste a club newsletter or syllabus. Rhett pulls out meetings, exams and deadlines."
          className="mt-3 w-full rounded-lg border border-zinc-300 p-2 text-xs"
        />
        <div className="mt-2">
          <Button variant="secondary" onClick={extract} disabled={!paste.trim() || extracting}>{extracting ? "Reading…" : "Find events"}</Button>
        </div>
        {found.length > 0 && (
          <ul className="mt-2 space-y-1">
            {found.map((e, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2 py-1.5 text-xs">
                <Pill tone={e.kind === "exam" ? "amber" : "zinc"}>{e.kind}</Pill>
                <span className="flex-1">{e.title} <span className="text-zinc-500">{e.weekday ?? e.date} {e.start != null ? fmtTime(e.start) : ""}</span></span>
                {e.weekday && e.start != null && <button className="font-semibold text-bu" onClick={() => addClub(e)}>Add weekly</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="text-xs text-zinc-500">Wake up</span>
          <input type="time" value={toInputTime(prefs.wakeTime)} onChange={(e) => setPrefs({ wakeTime: fromInputTime(e.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-300 p-2" />
        </label>
        <Num label="Sleep (hours)" value={prefs.sleepHours} step={0.5} onChange={(n) => setPrefs({ sleepHours: n })} />
        <Num label="Study per day (hours)" value={prefs.studyHoursPerDay} step={0.5} onChange={(n) => setPrefs({ studyHoursPerDay: n })} />
        <Num label="Gym days / week" value={prefs.gymDaysPerWeek} onChange={(n) => setPrefs({ gymDaysPerWeek: Math.min(7, n) })} />
        <Num label="Gym minutes" value={prefs.gymMinutes} step={15} onChange={(n) => setPrefs({ gymMinutes: n })} />
        <div className="col-span-2">
          <p className="text-xs text-zinc-500">Weekly to-dos</p>
          <ul className="mt-1 space-y-1">
            {prefs.tasks.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{t.name}</span>
                <span className="text-xs text-zinc-500">{t.minutes} min × {t.timesPerWeek}/wk</span>
                <button className="text-zinc-400" onClick={() => setPrefs({ tasks: prefs.tasks.filter((_, j) => j !== i) })}>✕</button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-1">
            <input placeholder="Laundry, call home…" value={task.name} onChange={(e) => setTask({ ...task, name: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-2 text-sm" />
            <input type="number" value={task.minutes} onChange={(e) => setTask({ ...task, minutes: Number(e.target.value) })} className="w-14 rounded-lg border border-zinc-300 p-2 text-sm" title="minutes" />
            <input type="number" value={task.timesPerWeek} onChange={(e) => setTask({ ...task, timesPerWeek: Number(e.target.value) })} className="w-11 rounded-lg border border-zinc-300 p-2 text-sm" title="times per week" />
            <button
              className="rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white disabled:bg-zinc-300"
              disabled={!task.name.trim()}
              onClick={() => { setPrefs({ tasks: [...prefs.tasks, task] }); setTask({ name: "", minutes: 30, timesPerWeek: 1 }); }}
            >
              +
            </button>
          </div>
        </div>
      </Card>

      <Button onClick={build} disabled={loading}>{loading ? "Planning…" : "Plan my week"}</Button>

      {plan && (
        <>
          <WeekView plan={plan} />
          <Button variant="secondary" onClick={downloadIcs}>Add to Google / Apple Calendar (.ics)</Button>
        </>
      )}
    </div>
  );
}
