"use client";
import { useEffect, useMemo, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { CourseHistoryPicker } from "@/components/CourseHistoryPicker";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";
import { missingPrereqs, SectionPicker } from "@/components/SectionPicker";
import { SyllabusCard } from "@/components/SyllabusCard";
import { IconLayers, IconSparkle } from "@/components/icons";
import { Button, Card, CodeChip, EmptyState, PageTitle, Pill } from "@/components/ui";
import { useProfile } from "@/lib/profile";
import { conflicts, emptySchedule, shortCode, withCourse, withoutCourse } from "@/lib/schedule";
import type { Course, PlannedCourse, Section } from "@/lib/types";

const TERMS = ["Fall 2026", "Spring 2027"];
type Hit = { code: string; title: string; units?: string; sections?: number };

export default function PlanPage() {
  const { profile, update } = useProfile();
  const term = profile.term;
  const schedule = profile.semester?.term === term ? profile.semester : emptySchedule(term);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState<Course | null>(null);
  const [preview, setPreview] = useState<Section[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Record<string, Course>>({});
  const [history, setHistory] = useState(false);
  const [rhett, setCampusWizard] = useState(false);

  useEffect(() => {
    setSearched(false);
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(
      () =>
        fetch(`/api/courses?q=${encodeURIComponent(q)}&term=${encodeURIComponent(term)}`)
          .then((r) => r.json())
          .then((list: Hit[]) => {
            setHits(list);
            setSearched(true);
          })
          .catch(() => setSearched(true)),
      200,
    );
    return () => clearTimeout(t);
  }, [q, term]);

  // Full course records for picked classes (prereqs for warnings)
  const pickedKey = schedule.courses.map((c) => c.code).join(",");
  useEffect(() => {
    for (const c of schedule.courses) {
      if (catalog[c.code]) continue;
      fetch(`/api/courses?code=${encodeURIComponent(c.code)}`).then((r) => r.json()).then((full: Course) => setCatalog((m) => ({ ...m, [c.code]: full })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedKey]);

  const openCourse = async (code: string) => {
    const full: Course = catalog[code] ?? (await fetch(`/api/courses?code=${encodeURIComponent(code)}`).then((r) => r.json()));
    setCatalog((m) => ({ ...m, [code]: full }));
    setPreview(null);
    setOpen(full);
    setQ("");
    setHits([]);
  };

  const save = (next: typeof schedule) => update({ semester: next });
  const add = (course: PlannedCourse) => {
    save(withCourse(schedule, course));
    setOpen(null);
    setPreview(null);
  };

  const clashes = useMemo(() => conflicts(schedule.courses), [schedule.courses]);
  const clashOf = (code: string) => [...new Set(clashes.flatMap((k) => (k.a === code ? [k.b] : k.b === code ? [k.a] : [])))];

  return (
    <div className="space-y-4 pb-16">
      <PageTitle title="A little foresight. A better semester." subtitle="Shape your semester one course at a time. Clashes show up before you add a class." />
      <div className="-mt-2 flex items-center gap-2">
        <label className="sr-only" htmlFor="term">Term</label>
        <select id="term" value={term} onChange={(e) => update({ term: e.target.value })} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold">
          {TERMS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span className="text-xs text-zinc-500">{schedule.courses.length} courses · {schedule.totalUnits} credits</span>
      </div>

      {term !== "Fall 2026" && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="flex-1">BU hasn&apos;t posted {term} sections yet, so there are no sections to pick.</span>
          <button onClick={() => update({ term: "Fall 2026" })} className="shrink-0 rounded-lg bg-amber-800 px-2 py-1 font-semibold text-white">Switch to Fall 2026</button>
        </div>
      )}

      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a course: WR 153, MA 226, intro to CS…"
          aria-label="Search BU courses"
          className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm shadow-sm"
        />
        {searched && hits.length === 0 && q.trim().length >= 2 && (
          <p role="status" className="absolute inset-x-0 top-full z-30 mt-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-lg">
            No courses found for &ldquo;{q}&rdquo;. Try a code like &ldquo;MA 226&rdquo; or a title word.
          </p>
        )}
        {hits.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white text-sm shadow-lg">
            {hits.map((h) => (
              <li key={h.code}>
                <button onClick={() => openCourse(h.code)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{h.code}</span> <span className="text-zinc-500">{h.title}</span>
                  </span>
                  <span className={`shrink-0 text-xs ${h.sections ? "text-zinc-500" : "text-zinc-300"}`}>{h.sections ? `${h.sections} sections` : "not offered"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <Card>
          <SectionPicker
            key={open.code} // fresh picks for every course, never carried over from the last one
            course={open}
            term={term}
            schedule={schedule.courses}
            completed={profile.completed}
            onPreview={setPreview}
            onAdd={add}
            onClose={() => { setOpen(null); setPreview(null); }}
            onSwitchTerm={term !== "Fall 2026" ? () => update({ term: "Fall 2026" }) : undefined}
          />
        </Card>
      )}

      {(schedule.courses.length > 0 || open) && <Card className={open ? "sticky top-14 z-10 !p-2" : "!p-3"}>
        <div className="mb-2 flex items-center justify-between px-1 text-xs">
          <span className="font-semibold">{term}</span>
          <span className="flex gap-1">
            {clashes.length > 0 && <Pill tone="red">{clashes.length} clash{clashes.length > 1 ? "es" : ""}</Pill>}
            <Pill tone={schedule.totalUnits > 18 ? "amber" : "zinc"}>{schedule.totalUnits} units</Pill>
          </span>
        </div>
        <ScheduleCalendar
          courses={schedule.courses}
          preview={open && preview ? { code: open.code, sections: preview } : null}
          selected={selected}
          onSelect={(code) => setSelected(selected === code ? null : code)}
          scale={open ? 0.36 : 0.6}
        />
      </Card>}

      {schedule.courses.length === 0 ? (
        !open && (
          <Card>
            <EmptyState
              icon={<IconLayers size={20} />}
              title="Your next chapter is open."
              body="Search any BU course above, or let CampusWizard suggest a schedule from your major. You can adjust every class."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button full={false} variant="secondary" onClick={() => document.querySelector<HTMLInputElement>('input[aria-label="Search BU courses"]')?.focus()}>Find a course</Button>
                  <Button full={false} onClick={() => setCampusWizard(true)}><IconSparkle size={16} /> Suggest a schedule</Button>
                </div>
              }
            />
          </Card>
        )
      ) : (
        <ul className="space-y-2">
          {schedule.courses.map((c, i) => {
            const clash = clashOf(c.code);
            const full = catalog[c.code];
            const missing = full ? missingPrereqs(full, profile.completed) : [];
            return (
              <li key={c.code}>
                <Card className={`!p-3 ${selected === c.code ? "ring-2 ring-zinc-900" : ""}`}>
                  <div className="flex items-start gap-3">
                    <CodeChip code={shortCode(c.code)} index={i} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{c.title}</p>
                      <ul className="mt-0.5 text-xs text-zinc-600">
                        {c.sections.length ? c.sections.map((s, j) => (
                          <li key={j}><span className="font-mono">{s.section}</span> {s.schedule.raw} · {s.location} · {s.instructor}</li>
                        )) : <li>Times not posted yet</li>}
                      </ul>
                      {clash.length > 0 && <p className="mt-1 text-xs font-medium text-red-600">Clashes with {clash.map(shortCode).join(", ")}</p>}
                      {missing.length > 0 && <p className="mt-1 text-xs text-amber-700">Missing prereq: {missing.join("; ")}</p>}
                    </div>
                    <Pill>{c.units}u</Pill>
                  </div>
                  <div className="mt-2 flex gap-2 text-xs font-semibold">
                    <button onClick={() => openCourse(c.code)} className="flex-1 rounded-lg border border-zinc-200 py-1.5">Change section</button>
                    <button onClick={() => save(withoutCourse(schedule, c.code))} className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-bu">Remove</button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <SyllabusCard profile={profile} update={update} />

      <Card className="!p-3">
        <button onClick={() => setHistory(!history)} className="flex w-full items-center justify-between text-sm font-semibold">
          <span>Courses I took before {term} <span className="font-normal text-zinc-500">({profile.completed.length})</span></span>
          <span className="text-zinc-400">{history ? "▲" : "▼"}</span>
        </button>
        {history && (
          <div className="mt-3">
            <CourseHistoryPicker majorId={profile.majorId} value={profile.completed} onChange={(completed) => update({ completed })} />
          </div>
        )}
      </Card>

      <button
        onClick={() => setCampusWizard(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-bu px-4 py-3 text-sm font-semibold text-white shadow-lg sm:right-[max(1rem,calc(50%-14rem))]"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-bu"><IconSparkle size={15} /></span>
        Ask CampusWizard
      </button>

      {/* kept mounted while hidden so the conversation (and replies still on their way) survive closing */}
      {(
        <div className={`fixed inset-0 z-40 flex items-end justify-center bg-black/30 ${rhett ? "" : "hidden"}`} onClick={() => setCampusWizard(false)}>
          <div className="flex h-[75dvh] w-full max-w-md flex-col rounded-t-3xl bg-zinc-50 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">CampusWizard · {term} planning</p>
              <button onClick={() => setCampusWizard(false)} className="text-xl leading-none text-zinc-400" aria-label="Close">×</button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel
                compact
                profile={profile}
                update={update}
                suggestions={["Suggest a schedule for me", "Is there a morning WR 153 section?", "Any clashes?", "Add MA 226 with Stevens"]}
                intro={<p className="text-sm text-zinc-500">I can see your calendar. Ask me to find sections, fix clashes, or add and drop classes.</p>}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
