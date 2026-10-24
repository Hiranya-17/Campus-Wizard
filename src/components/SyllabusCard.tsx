"use client";
import { useRef, useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { SAMPLE_SYLLABUS } from "@/lib/demo";
import { fmtTime } from "@/lib/format";
import { daysUntil, shortCourse } from "@/lib/study";
import type { Assignment, AssignmentKind, Profile, SyllabusResponse } from "@/lib/types";

const KIND_TONE: Record<AssignmentKind, "red" | "amber" | "zinc" | "green"> = { exam: "red", quiz: "amber", homework: "zinc", project: "green", paper: "green" };

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function AssignmentRow({ a, onRemove, checked, onToggle }: { a: Assignment; onRemove?: () => void; checked?: boolean; onToggle?: () => void }) {
  const days = daysUntil(a);
  return (
    <li className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs shadow-sm">
      {onToggle && <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Keep ${a.title}`} />}
      <span className="w-20 shrink-0 text-zinc-500">{fmtDate(a.date)}{a.time != null ? ` ${fmtTime(a.time).replace(":00", "")}` : ""}</span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{shortCourse(a.courseCode)} {a.title}</span>
        {a.topics.length > 0 && <span className="block truncate text-zinc-500">{a.topics.join(", ")}</span>}
      </span>
      {a.weight != null && <span className="shrink-0 text-zinc-500">{a.weight}%</span>}
      <Pill tone={KIND_TONE[a.kind]}>{a.kind}</Pill>
      {days >= 0 && days <= 3 && !onToggle && <span className="shrink-0 font-semibold text-bu">{days === 0 ? "today" : `${days}d`}</span>}
      {onRemove && <button onClick={onRemove} className="text-zinc-300" aria-label={`Remove ${a.title}`}>✕</button>}
    </li>
  );
}

/**
 * Upload a syllabus per course; Gemini lists every exam, quiz, homework, project and paper.
 * Saved items drive the Home "what to study" card, the week planner and the calendar export.
 */
export function SyllabusCard({ profile, update }: { profile: Profile; update: (patch: Partial<Profile>) => void }) {
  const courses = profile.semester?.courses.map((c) => c.code) ?? [];
  const [course, setCourse] = useState(courses[0] ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Assignment[] | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = [...(profile.assignments ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = saved.filter((a) => daysUntil(a) >= 0);

  const read = async (body: { courseCode: string; text?: string; pdfBase64?: string }) => {
    if (!body.courseCode.trim()) return setMsg("Pick or type the course first.");
    setBusy(true);
    setMsg(null);
    setFound(null);
    try {
      const res = await fetch("/api/syllabus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data: SyllabusResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`);
      setFound(data.items);
      setKeep(new Set(data.items.map((i) => i.id)));
      setMsg(data.note ?? (data.items.length ? null : "Didn't find any dated exams or homework. Try pasting the schedule section."));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't read the syllabus.");
    }
    setBusy(false);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 3_000_000) return setMsg("That file is over 3 MB. Paste the schedule section instead.");
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) await read({ courseCode: course, pdfBase64: await fileToBase64(file) });
    else await read({ courseCode: course, text: await file.text() });
  };

  const save = () => {
    if (!found) return;
    const chosen = found.filter((i) => keep.has(i.id));
    const code = found[0]?.courseCode ?? course;
    // replace this course's earlier syllabus items so re-uploading doesn't duplicate them
    const others = (profile.assignments ?? []).filter((a) => !(a.courseCode === code && a.source === "syllabus"));
    update({ assignments: [...others, ...chosen] });
    setFound(null);
    setText("");
    setMsg(`Saved ${chosen.length} items for ${shortCourse(code)}.`);
  };

  const downloadIcs = async () => {
    const res = await fetch("/api/assignments.ics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignments: upcoming }) });
    if (!res.ok) return setMsg("Couldn't build the calendar file. Try again.");
    const url = URL.createObjectURL(await res.blob());
    Object.assign(document.createElement("a"), { href: url, download: "rhett-exams-and-homework.ics" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="space-y-3 !p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Exams &amp; homework <span className="font-normal text-zinc-500">({upcoming.length} upcoming)</span></p>
        <button
          onClick={() => { setCourse(SAMPLE_SYLLABUS.courseCode); setText(SAMPLE_SYLLABUS.text); }}
          className="text-xs font-medium text-bu"
        >
          Try a sample syllabus
        </button>
      </div>

      <div className="flex gap-1">
        <input
          list="syllabus-courses"
          value={course}
          onChange={(e) => setCourse(e.target.value.toUpperCase())}
          placeholder="Course, e.g. CAS MA 226"
          aria-label="Course for this syllabus"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-2 text-sm"
        />
        <datalist id="syllabus-courses">{courses.map((c) => <option key={c} value={c} />)}</datalist>
        <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="shrink-0 rounded-lg border border-zinc-300 px-3 text-sm font-semibold disabled:opacity-50">
          Upload PDF
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label="Syllabus text"
        placeholder="…or paste the syllabus (the schedule / grading part is enough)"
        className="w-full rounded-lg border border-zinc-300 p-2 text-xs"
      />
      <Button onClick={() => read({ courseCode: course, text })} disabled={busy || !text.trim()}>
        {busy ? "Reading syllabus…" : "Find exams & homework"}
      </Button>
      <p className="text-[11px] text-zinc-400">The syllabus is sent to Google Gemini to read it; we keep only the dates you save.</p>
      {msg && <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">{msg}</p>}

      {found && found.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500">Found {found.length}. Untick anything wrong, then save.</p>
          <ul className="space-y-1">
            {found.map((a) => (
              <AssignmentRow
                key={a.id}
                a={a}
                checked={keep.has(a.id)}
                onToggle={() => setKeep((k) => { const n = new Set(k); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}
              />
            ))}
          </ul>
          <Button onClick={save}>Save {keep.size} to my plan</Button>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-1">
            {upcoming.slice(0, 12).map((a) => (
              <AssignmentRow key={a.id} a={a} onRemove={() => update({ assignments: saved.filter((x) => x.id !== a.id) })} />
            ))}
          </ul>
          <Button variant="secondary" onClick={downloadIcs}>Add all to Google / Apple Calendar (with reminders)</Button>
          <p className="text-[11px] text-zinc-400">Reminders: exams 1 week, 2 days and 1 day before; homework 1 day and 2 hours before.</p>
        </div>
      )}
    </Card>
  );
}
