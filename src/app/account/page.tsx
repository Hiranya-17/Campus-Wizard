"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CourseHistoryPicker, useUnits } from "@/components/CourseHistoryPicker";
import { Button, Card, PageTitle } from "@/components/ui";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { standingFor, starterProfile } from "@/lib/demo";
import { authRequest, logout, useProfile } from "@/lib/profile";
import type { Profile } from "@/lib/types";

const STANDINGS: Profile["standing"][] = ["freshman", "sophomore", "junior", "senior"];

/** Shows Gmail/Calendar connection status and a disconnect button. */
function GoogleConnectedCard() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setConnected(Boolean(d.connected)))
      .catch(() => setConnected(false));
  }, []);

  if (connected === null || !connected) return null; // don't show if not connected or loading

  const disconnect = async () => {
    setBusy(true);
    await fetch("/api/google/disconnect", { method: "POST" });
    setConnected(false);
    setBusy(false);
  };

  return (
    <Card className="flex items-center gap-3 text-sm">
      <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0" aria-hidden="true">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
      </svg>
      <div className="flex-1">
        <p className="font-medium">Google connected</p>
        <p className="text-xs text-zinc-500">Gmail and Calendar are available.</p>
      </div>
      <button
        onClick={disconnect}
        disabled={busy}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {busy ? "Disconnecting…" : "Disconnect"}
      </button>
    </Card>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block text-sm">
      <span className="text-xs text-zinc-500">{label}</span>
      <input {...rest} className="mt-1 w-full rounded-lg border border-zinc-300 p-2" />
    </label>
  );
}

/**
 * First step after signing up with Google: Google gives us a name and email only, so ask for
 * major, year, where they live and the courses they've already taken, then go plan the term.
 */
function FinishSetup({
  profile, update, majors, places,
}: {
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  majors: { id: string; name: string }[];
  places: { code: string; name: string }[];
}) {
  const [standingTouched, setStandingTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const units = useUnits(profile.completed);
  useEffect(() => {
    if (!standingTouched && standingFor(units) !== profile.standing) update({ standing: standingFor(units) });
  }, [units, standingTouched, profile.standing, update]);

  const finish = async () => {
    setSaving(true);
    setError(null);
    // save right away: profile edits are normally saved after a short delay, which leaving the page would cancel
    const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    if (!res.ok) {
      setSaving(false);
      return setError("Couldn't save. Check your connection and try again.");
    }
    window.location.href = "/plan";
  };

  return (
    <div className="space-y-4">
      <PageTitle title={`Welcome, ${profile.name?.split(" ")[0] ?? "Terrier"}!`} subtitle="One quick step so Rhett can plan your semester: your major, year and the courses you've already taken." />
      <Card className="grid grid-cols-2 gap-2 text-sm">
        <label className="col-span-2">
          <span className="text-xs text-zinc-500">Major</span>
          <select value={profile.majorId} onChange={(e) => update({ majorId: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 p-2">
            {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>
          <span className="text-xs text-zinc-500">Year</span>
          <select
            value={profile.standing}
            onChange={(e) => { setStandingTouched(true); update({ standing: e.target.value as Profile["standing"] }); }}
            className="mt-1 w-full rounded-lg border border-zinc-300 p-2 capitalize"
          >
            {STANDINGS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>
          <span className="text-xs text-zinc-500">I live at</span>
          <select value={profile.home ?? "WARREN"} onChange={(e) => update({ home: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 p-2">
            {places.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
      </Card>
      <Card>
        <p className="text-sm font-semibold">Courses you&apos;ve taken before this semester</p>
        <p className="mb-3 text-xs text-zinc-500">
          Rhett checks prerequisites against these. Don&apos;t include classes you&apos;re taking now.{units > 0 && ` ${units} units, so you're a ${profile.standing}.`}
        </p>
        <CourseHistoryPicker majorId={profile.majorId} value={profile.completed} onChange={(completed) => update({ completed })} />
      </Card>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button onClick={finish} disabled={saving}>{saving ? "Saving…" : "Continue to my schedule"}</Button>
      <button onClick={() => { window.location.href = "/"; }} className="w-full text-center text-xs text-zinc-400">Skip for now</button>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}

function Account() {
  const { profile, user, ready, reset, update } = useProfile();
  const setup = useSearchParams().get("setup") === "1";
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

  if (user && setup) return <FinishSetup profile={profile} update={update} majors={majors} places={places} />;

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
        <GoogleConnectedCard />
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
      <GoogleSignInButton />
      <div className="flex items-center gap-3">
        <hr className="flex-1 border-zinc-200" />
        <span className="text-xs text-zinc-400">or with email</span>
        <hr className="flex-1 border-zinc-200" />
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
