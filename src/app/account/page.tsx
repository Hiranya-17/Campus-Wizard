"use client";
import { useEffect, useState } from "react";
import { CourseHistoryPicker, useUnits } from "@/components/CourseHistoryPicker";
import { Button, Card, PageTitle } from "@/components/ui";
import { standingFor, starterProfile } from "@/lib/demo";
import { authRequest, logout, useProfile } from "@/lib/profile";
import type { Profile } from "@/lib/types";

const STANDINGS: Profile["standing"][] = ["freshman", "sophomore", "junior", "senior"];

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block text-sm">
      <span className="text-xs text-zinc-500">{label}</span>
      <input {...rest} className="mt-1 w-full rounded-lg border border-zinc-300 p-2" />
    </label>
  );
}

export default function AccountPage() {
  const { profile, user, ready, reset, update } = useProfile();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [form, setForm] = useState({ name: "", email: "", password: "", majorId: "ce", standing: "freshman" as Profile["standing"], home: "WARREN", keepGuest: false, completed: [] as string[] });
  const [standingTouched, setStandingTouched] = useState(false);
  const historyUnits = useUnits(form.completed);
  useEffect(() => {
    if (!standingTouched) setForm((f) => ({ ...f, standing: standingFor(historyUnits) }));
  }, [historyUnits, standingTouched]);
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([]);
  const [places, setPlaces] = useState<{ code: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/majors").then((r) => r.json()).then(setMajors);
    fetch("/api/transit").then((r) => r.json()).then(setPlaces);
  }, []);

  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body =
      mode === "login"
        ? { email: form.email, password: form.password }
        : {
            name: form.name, email: form.email, password: form.password,
            profile: form.keepGuest
              ? { ...profile, name: form.name, majorId: form.majorId, standing: form.standing, home: form.home }
              : starterProfile({ name: form.name, majorId: form.majorId, standing: form.standing, home: form.home, completed: form.completed }),
          };
    const err = await authRequest(mode, body);
    setBusy(false);
    if (err) return setError(err);
    window.location.href = mode === "signup" ? "/plan" : "/";
  };

  if (!ready) return <p className="text-sm text-zinc-400">Loading…</p>;

  if (user) {
    return (
      <div className="space-y-4">
        <PageTitle title="Your account" />
        <Card className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-bu text-lg font-bold text-white">{user.name[0]?.toUpperCase()}</span>
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>
        </Card>
        <Card className="text-sm text-zinc-600">
          Your courses, plans, clubs and spending are saved to your account, so they follow you to any device.
          <p className="mt-2 text-xs text-zinc-400">{profile.completed.length} courses taken · {profile.semester?.courses.length ?? 0} classes this term · {profile.expenses?.length ?? 0} purchases logged</p>
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold">Courses I&apos;ve taken <span className="font-normal text-zinc-500">(before {profile.term})</span></p>
          <CourseHistoryPicker majorId={profile.majorId} value={profile.completed} onChange={(completed) => update({ completed })} />
        </Card>
        <Button variant="secondary" onClick={async () => { await logout(); window.location.href = "/"; }}>Log out</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle title={mode === "signup" ? "Create your account" : "Welcome back"} subtitle="Save your plans, clubs and budget across devices." />
      <div className="flex gap-1 rounded-xl bg-zinc-200 p-1 text-sm font-semibold">
        {(["signup", "login"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setError(null); }} className={`flex-1 rounded-lg py-1.5 ${mode === m ? "bg-white shadow-sm" : "text-zinc-600"}`}>
            {m === "signup" ? "Sign up" : "Log in"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Card className="space-y-3">
          {mode === "signup" && <Field label="Name" value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" required />}
          <Field label="Email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" required />
          <Field label="Password (8+ characters)" type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required />
        </Card>
        {mode === "signup" && (
          <Card className="grid grid-cols-2 gap-2 text-sm">
            <label className="col-span-2">
              <span className="text-xs text-zinc-500">Major</span>
              <select value={form.majorId} onChange={(e) => set({ majorId: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 p-2">
                {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs text-zinc-500">Year</span>
              <select value={form.standing} onChange={(e) => { setStandingTouched(true); set({ standing: e.target.value as Profile["standing"] }); }} className="mt-1 w-full rounded-lg border border-zinc-300 p-2 capitalize">
                {STANDINGS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs text-zinc-500">I live at</span>
              <select value={form.home} onChange={(e) => set({ home: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 p-2">
                {places.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-xs text-zinc-600">
              <input type="checkbox" checked={form.keepGuest} onChange={(e) => set({ keepGuest: e.target.checked })} />
              Keep what I set up as a guest (courses, clubs, spending)
            </label>
          </Card>
        )}
        {mode === "signup" && !form.keepGuest && (
          <Card>
            <p className="text-sm font-semibold">Courses you&apos;ve taken before this semester</p>
            <p className="mb-3 text-xs text-zinc-500">Rhett checks prerequisites against these. Don&apos;t include classes you&apos;re taking now. {historyUnits > 0 && `${historyUnits} units, so you're a ${form.standing}.`}</p>
            <CourseHistoryPicker majorId={form.majorId} value={form.completed} onChange={(completed) => set({ completed })} />
          </Card>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "One sec…" : mode === "signup" ? "Create account" : "Log in"}</Button>
      </form>
      <button onClick={reset} className="w-full text-center text-xs text-zinc-400">Reset guest demo data</button>
    </div>
  );
}
