"use client";
import { useEffect, useState } from "react";
import { Button, Card, PageTitle } from "@/components/ui";
import { SemesterView } from "@/components/views";
import { useProfile } from "@/lib/profile";
import type { Major, Profile, SemesterPlanResponse } from "@/lib/types";

const STANDINGS: Profile["standing"][] = ["freshman", "sophomore", "junior", "senior"];
const TERMS = ["Spring 2027", "Fall 2027"];

export default function PlanPage() {
  const { profile, update } = useProfile();
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([]);
  const [major, setMajor] = useState<Major | null>(null);
  const [plan, setPlan] = useState<SemesterPlanResponse | null>(profile.semester ?? null);
  const [loading, setLoading] = useState(false);
  const [extra, setExtra] = useState("");
  const [hits, setHits] = useState<{ code: string; title: string }[]>([]);

  useEffect(() => {
    fetch("/api/majors").then((r) => r.json()).then(setMajors);
  }, []);
  useEffect(() => {
    fetch(`/api/majors?id=${profile.majorId}`).then((r) => r.json()).then(setMajor);
  }, [profile.majorId]);
  useEffect(() => {
    if (profile.semester) setPlan(profile.semester);
  }, [profile.semester]);
  useEffect(() => {
    if (extra.trim().length < 3) return setHits([]);
    const t = setTimeout(() => fetch(`/api/courses?q=${encodeURIComponent(extra)}`).then((r) => r.json()).then(setHits), 250);
    return () => clearTimeout(t);
  }, [extra]);

  const done = new Set(profile.completed);
  const toggle = (code: string) =>
    update({ completed: done.has(code) ? profile.completed.filter((c) => c !== code) : [...profile.completed, code] });

  const build = async () => {
    setLoading(true);
    const res = await fetch("/api/plan/semester", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ majorId: profile.majorId, term: profile.term, standing: profile.standing, completed: profile.completed }),
    });
    setPlan(await res.json());
    setLoading(false);
  };

  const sheetCodes = major ? major.plan.flatMap((t) => t.slots.filter((s) => s.kind === "course").map((s) => (s as { code: string }).code)) : [];
  const offSheet = profile.completed.filter((c) => !sheetCodes.includes(c));

  return (
    <div className="space-y-4">
      <PageTitle title="Plan registration" subtitle="Tick what you've taken. Rhett checks prerequisites, your major sheet and time conflicts." />

      <Card className="grid grid-cols-3 gap-2 text-sm">
        <label className="col-span-3">
          <span className="text-xs text-zinc-500">Major</span>
          <select className="mt-1 w-full rounded-lg border border-zinc-300 p-2" value={profile.majorId} onChange={(e) => update({ majorId: e.target.value, semester: undefined })}>
            {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="col-span-2">
          <span className="text-xs text-zinc-500">Planning for</span>
          <select className="mt-1 w-full rounded-lg border border-zinc-300 p-2" value={profile.term} onChange={(e) => update({ term: e.target.value })}>
            {TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <span className="text-xs text-zinc-500">Standing</span>
          <select className="mt-1 w-full rounded-lg border border-zinc-300 p-2 capitalize" value={profile.standing} onChange={(e) => update({ standing: e.target.value as Profile["standing"] })}>
            {STANDINGS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </Card>

      {major && (
        <Card>
          <p className="mb-2 text-sm font-semibold">Courses you&apos;ve taken <span className="font-normal text-zinc-500">({profile.completed.length})</span></p>
          <div className="space-y-2">
            {major.plan.map((t) => {
              const codes = t.slots.filter((s) => s.kind === "course").map((s) => (s as { code: string }).code);
              if (!codes.length) return null;
              return (
                <div key={t.term}>
                  <p className="text-[11px] uppercase tracking-wide text-zinc-400">{t.term}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {codes.map((c) => (
                      <button key={c} onClick={() => toggle(c)} className={`rounded-full border px-2.5 py-1 text-xs ${done.has(c) ? "border-bu bg-bu text-white" : "border-zinc-300 bg-white text-zinc-700"}`}>
                        {c.split(" ").slice(1).join(" ")}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Other courses</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {offSheet.map((c) => (
                  <button key={c} onClick={() => toggle(c)} className="rounded-full border border-bu bg-bu px-2.5 py-1 text-xs text-white">{c} ×</button>
                ))}
              </div>
              <input className="mt-2 w-full rounded-lg border border-zinc-300 p-2 text-sm" placeholder="Add a course: WR 150, intro to psych…" value={extra} onChange={(e) => setExtra(e.target.value)} />
              {hits.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 text-sm">
                  {hits.map((h) => (
                    <li key={h.code}>
                      <button className="w-full px-2 py-1.5 text-left hover:bg-zinc-50" onClick={() => { toggle(h.code); setExtra(""); }}>
                        <span className="font-medium">{h.code}</span> <span className="text-zinc-500">{h.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <Button onClick={build} disabled={loading}>{loading ? "Planning…" : `Build my ${profile.term} plan`}</Button>

      {plan && "courses" in plan && (
        <>
          <SemesterView plan={plan} />
          <Button variant="secondary" onClick={() => update({ semester: plan })}>
            {profile.semester === plan ? "Saved as my semester ✓" : "Use this as my semester"}
          </Button>
        </>
      )}
    </div>
  );
}
