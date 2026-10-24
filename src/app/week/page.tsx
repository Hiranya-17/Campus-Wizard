"use client";
import { useState } from "react";
import { Button, Card, PageTitle, Pill } from "@/components/ui";
import { WeekView } from "@/components/views";
import { ApiError, postSemesterPlan, postWeekPlan } from "@/lib/api";
import { DEFAULT_PREFS } from "@/lib/demo";
import { fmtTime, fromInputTime, toInputTime } from "@/lib/format";
import { classEvents } from "@/lib/planner/week";
import { useProfile } from "@/lib/profile";
import type {
  ExtractResponse,
  ExtractedEvent,
  SemesterPlanRequest,
  WeekEvent,
  WeekPlanRequest,
  WeekPlanResponse,
  WeekPrefs,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// WeekPrefsForm — 2-col grid for wake-time + 4 numeric prefs
// ---------------------------------------------------------------------------

interface WeekPrefsFormProps {
  prefs: WeekPrefs;
  onChange: (patch: Partial<WeekPrefs>) => void;
}

function WeekPrefsForm({ prefs, onChange }: WeekPrefsFormProps) {
  return (
    <Card className="grid grid-cols-2 gap-2">
      {/* Wake time */}
      <label className="text-sm">
        <span className="text-xs text-zinc-500">Wake up</span>
        <input
          type="time"
          value={toInputTime(prefs.wakeTime)}
          onChange={(e) => onChange({ wakeTime: fromInputTime(e.target.value) })}
          className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
        />
      </label>

      {/* Sleep hours */}
      <label className="text-sm">
        <span className="text-xs text-zinc-500">Sleep (hours)</span>
        <input
          type="number"
          min={0.5}
          max={24}
          step={0.5}
          value={prefs.sleepHours}
          onChange={(e) => onChange({ sleepHours: Math.max(0.5, Math.min(24, Number(e.target.value))) })}
          className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
        />
      </label>

      {/* Study hours per day */}
      <label className="text-sm">
        <span className="text-xs text-zinc-500">Study per day (hours)</span>
        <input
          type="number"
          min={0.5}
          max={24}
          step={0.5}
          value={prefs.studyHoursPerDay}
          onChange={(e) => onChange({ studyHoursPerDay: Math.max(0.5, Math.min(24, Number(e.target.value))) })}
          className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
        />
      </label>

      {/* Gym days per week */}
      <label className="text-sm">
        <span className="text-xs text-zinc-500">Gym days / week</span>
        <input
          type="number"
          min={0}
          max={7}
          step={1}
          value={prefs.gymDaysPerWeek}
          onChange={(e) => onChange({ gymDaysPerWeek: Math.max(0, Math.min(7, Number(e.target.value))) })}
          className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
        />
      </label>

      {/* Gym minutes */}
      <label className="text-sm">
        <span className="text-xs text-zinc-500">Gym minutes</span>
        <input
          type="number"
          min={15}
          max={240}
          step={15}
          value={prefs.gymMinutes}
          onChange={(e) => onChange({ gymMinutes: Math.max(15, Math.min(240, Number(e.target.value))) })}
          className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
        />
      </label>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// WeekToDoList — existing to-do list + add-task row
// ---------------------------------------------------------------------------

interface WeekToDoListProps {
  tasks: WeekPrefs["tasks"];
  onRemove: (index: number) => void;
  onAdd: (task: { name: string; minutes: number; timesPerWeek: number }) => void;
}

function WeekToDoList({ tasks, onRemove, onAdd }: WeekToDoListProps) {
  const [draft, setDraft] = useState({ name: "", minutes: 30, timesPerWeek: 1 });

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    onAdd({
      name: draft.name,
      minutes: Math.max(1, Math.min(480, draft.minutes)),
      timesPerWeek: Math.max(1, Math.min(7, draft.timesPerWeek)),
    });
    setDraft({ name: "", minutes: 30, timesPerWeek: 1 });
  };

  return (
    <div className="col-span-2">
      <p className="text-xs text-zinc-500">Weekly to-dos</p>
      <ul className="mt-1 space-y-1">
        {tasks.map((t, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{t.name}</span>
            <span className="text-xs text-zinc-500">
              {t.minutes} min × {t.timesPerWeek}/wk
            </span>
            <button className="text-zinc-400" onClick={() => onRemove(i)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-1">
        <input
          placeholder="Laundry, call home…"
          value={draft.name}
          maxLength={100}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-2 text-sm"
        />
        <input
          type="number"
          min={1}
          max={480}
          value={draft.minutes}
          onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })}
          className="w-14 rounded-lg border border-zinc-300 p-2 text-sm"
          title="minutes"
        />
        <input
          type="number"
          min={1}
          max={7}
          value={draft.timesPerWeek}
          onChange={(e) => setDraft({ ...draft, timesPerWeek: Number(e.target.value) })}
          className="w-11 rounded-lg border border-zinc-300 p-2 text-sm"
          title="times per week"
        />
        <button
          className="rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white disabled:bg-zinc-300"
          disabled={!draft.name.trim()}
          onClick={handleAdd}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeekPage
// ---------------------------------------------------------------------------

export default function WeekPage() {
  const { profile, update } = useProfile();
  const prefs = profile.prefs ?? DEFAULT_PREFS;
  const setPrefs = (patch: Partial<WeekPrefs>) =>
    update({ prefs: { ...prefs, ...patch } });

  const [plan, setPlan] = useState<WeekPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [icsError, setIcsError] = useState<string | null>(null);

  const [paste, setPaste] = useState("");
  const [found, setFound] = useState<ExtractedEvent[]>([]);
  const [extracting, setExtracting] = useState(false);

  // Build the WeekPlanRequest, fetching semester plan if not already saved
  const request = async (): Promise<WeekPlanRequest> => {
    let semester = profile.semester;
    if (!semester) {
      const semReq: SemesterPlanRequest = {
        majorId: profile.majorId,
        term: profile.term,
        standing: profile.standing,
        completed: profile.completed,
      };
      semester = await postSemesterPlan(semReq);
    }
    return {
      weekOf: nextMonday(),
      fixed: [...classEvents(semester?.courses ?? []), ...(profile.clubs ?? [])],
      prefs,
    };
  };

  const build = async () => {
    setLoading(true);
    setBuildError(null);
    try {
      const req = await request();
      const result = await postWeekPlan(req);
      setPlan(result);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `Server error (${err.status}). Please try again.`
          : "Could not reach the server. Check your connection.";
      setBuildError(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadIcs = async () => {
    setIcsError(null);
    try {
      const req = await request();
      const res = await fetch("/api/week.ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `rhett-week-${nextMonday()}.ics`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not download the calendar file.";
      setIcsError(msg);
    }
  };

  const extract = async () => {
    setExtracting(true);
    const res = await fetch("/api/extract-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: /syllabus|midterm|exam|homework/i.test(paste) ? "syllabus" : "email",
        text: paste,
      }),
    });
    const data: ExtractResponse = await res.json();
    setFound(data.events);
    setExtracting(false);
  };

  const addClub = (e: ExtractedEvent) => {
    if (!e.weekday || e.start == null) return;
    const ev: WeekEvent = {
      id: `club-${Date.now()}`,
      title: e.title.slice(0, 40),
      day: e.weekday,
      start: e.start,
      end: e.end ?? e.start + 60,
      kind: e.kind === "exam" ? "exam" : "club",
      location: e.location ?? undefined,
      fixed: true,
    };
    update({ clubs: [...(profile.clubs ?? []), ev] });
    setFound(found.filter((f) => f !== e));
  };

  const classes = profile.semester?.courses.length ?? 0;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Plan my week"
        subtitle="Rhett fits sleep, meals, study, gym and your to-dos around classes and clubs."
      />

      {/* Fixed events + extract */}
      <Card className="text-sm">
        <p className="font-semibold">Fixed this week</p>
        <p className="mt-1 text-xs text-zinc-500">
          {classes
            ? `${classes} courses from your saved semester plan`
            : "No saved semester yet. Rhett will use your suggested plan."}
        </p>
        <ul className="mt-2 space-y-1">
          {(profile.clubs ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-xs">
              <Pill tone="red">{c.kind}</Pill>
              <span className="font-medium">{c.title}</span>
              <span className="text-zinc-500">
                {c.day} {fmtTime(c.start)}
              </span>
              <button
                className="ml-auto text-zinc-400"
                onClick={() =>
                  update({ clubs: profile.clubs!.filter((x) => x.id !== c.id) })
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={3}
          maxLength={20000}
          placeholder="Paste a club newsletter or syllabus. Rhett pulls out meetings, exams and deadlines."
          className="mt-3 w-full rounded-lg border border-zinc-300 p-2 text-xs"
        />
        <div className="mt-2">
          <Button
            variant="secondary"
            onClick={extract}
            disabled={!paste.trim() || extracting}
          >
            {extracting ? "Reading…" : "Find events"}
          </Button>
        </div>
        {found.length > 0 && (
          <ul className="mt-2 space-y-1">
            {found.map((e, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2 py-1.5 text-xs"
              >
                <Pill tone={e.kind === "exam" ? "amber" : "zinc"}>{e.kind}</Pill>
                <span className="flex-1">
                  {e.title}{" "}
                  <span className="text-zinc-500">
                    {e.weekday ?? e.date}{" "}
                    {e.start != null ? fmtTime(e.start) : ""}
                  </span>
                </span>
                {e.weekday && e.start != null && (
                  <button
                    className="font-semibold text-bu"
                    onClick={() => addClub(e)}
                  >
                    Add weekly
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Preferences form */}
      <WeekPrefsForm prefs={prefs} onChange={setPrefs} />

      {/* To-do list — lives in its own Card to match original layout */}
      <Card>
        <WeekToDoList
          tasks={prefs.tasks}
          onRemove={(i) =>
            setPrefs({ tasks: prefs.tasks.filter((_, j) => j !== i) })
          }
          onAdd={(task) => setPrefs({ tasks: [...prefs.tasks, task] })}
        />
      </Card>

      {/* Build button + error */}
      <Button onClick={build} disabled={loading}>
        {loading ? "Planning…" : "Plan my week"}
      </Button>
      {buildError && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {buildError}
        </p>
      )}

      {/* Plan output */}
      {plan && (
        <>
          <WeekView plan={plan} />
          <Button variant="secondary" onClick={downloadIcs}>
            Add to Google / Apple Calendar (.ics)
          </Button>
          {icsError && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {icsError}
            </p>
          )}
        </>
      )}
    </div>
  );
}
