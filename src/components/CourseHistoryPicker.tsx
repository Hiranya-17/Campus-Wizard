"use client";
import { useEffect, useState } from "react";
import { shortCode } from "@/lib/schedule";
import type { Major } from "@/lib/types";

type Hit = { code: string; title: string; units?: string };

/** Units for a list of course codes (4 when unknown). */
export function useUnits(codes: string[]) {
  const [units, setUnits] = useState(0);
  const key = [...codes].sort().join(",");
  useEffect(() => {
    if (!codes.length) return setUnits(0);
    fetch(`/api/courses?codes=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((list: Hit[]) =>
        setUnits(
          codes.reduce((sum, c) => {
            const u = parseFloat(list.find((x) => x.code === c)?.units ?? "");
            return sum + (Number.isFinite(u) ? u : 4); // EK 100 really is 0 units
          }, 0),
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return units;
}

/**
 * Courses finished before the term being planned: the major sheet's courses as tap-to-toggle chips,
 * plus search for anything else (Hub courses, AP credit, electives).
 */
export function CourseHistoryPicker({ majorId, value, onChange }: { majorId: string; value: string[]; onChange: (codes: string[]) => void }) {
  const [major, setMajor] = useState<Major | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const done = new Set(value);

  useEffect(() => {
    fetch(`/api/majors?id=${majorId}`).then((r) => (r.ok ? r.json() : null)).then(setMajor);
  }, [majorId]);
  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(() => fetch(`/api/courses?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setHits), 200);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = (code: string) => onChange(done.has(code) ? value.filter((c) => c !== code) : [...value, code]);
  const sheet = major ? major.plan.flatMap((t) => t.slots.flatMap((s) => (s.kind === "course" ? [s.code] : []))) : [];
  const others = value.filter((c) => !sheet.includes(c));

  return (
    <div className="space-y-2">
      {major?.plan.map((t) => {
        const codes = t.slots.flatMap((s) => (s.kind === "course" ? [s.code] : []));
        if (!codes.length) return null;
        return (
          <div key={t.term}>
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">{t.term}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {codes.map((c) => (
                <button key={c} type="button" onClick={() => toggle(c)} className={`rounded-full border px-2.5 py-1 text-xs ${done.has(c) ? "border-bu bg-bu text-white" : "border-zinc-300 bg-white text-zinc-700"}`}>
                  {shortCode(c)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-zinc-400">Other courses, Hub, AP credit</p>
        {others.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {others.map((c) => (
              <button key={c} type="button" onClick={() => toggle(c)} className="rounded-full border border-bu bg-bu px-2.5 py-1 text-xs text-white">{c} ×</button>
            ))}
          </div>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: WR 150, PS 101, intro to psych…" className="mt-2 w-full rounded-lg border border-zinc-300 p-2 text-sm" />
        {hits.length > 0 && (
          <ul className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-zinc-200 bg-white text-sm">
            {hits.map((h) => (
              <li key={h.code}>
                <button type="button" className="w-full px-2 py-1.5 text-left hover:bg-zinc-50" onClick={() => { toggle(h.code); setQ(""); }}>
                  {done.has(h.code) ? "✓ " : ""}<span className="font-medium">{h.code}</span> <span className="text-zinc-500">{h.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
