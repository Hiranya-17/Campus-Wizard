"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconArrowRight, IconCalendar, IconFood, IconLayers, IconSparkle, LogoTile } from "@/components/icons";

/**
 * First-run workspace tour, in two short parts (each 5 steps, every step skippable, replayable from Account):
 * 1. an introduction to what CampusWizard does, with small previews of each area;
 * 2. "Show me around": the screen dims and each bottom tab is spotlighted with what it's for.
 * Replay from anywhere with: window.dispatchEvent(new Event("cw:tour")).
 */

const KEY = "cw.tour.v1";
const HIDE_ON = ["/privacy", "/terms"];

const seen = () => { try { return localStorage.getItem(KEY) === "done"; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(KEY, "done"); } catch {} };

// ---------- part 1: introduction ----------

function Preview({ step }: { step: number }) {
  const row = (bar: string, title: string, meta: string) => (
    <div className="flex gap-3 py-2">
      <span className={`w-1 rounded-full ${bar}`} />
      <span><p className="text-sm font-semibold">{title}</p><p className="text-xs text-zinc-500">{meta}</p></span>
    </div>
  );
  const chip = (code: string, tone: string, title: string, meta: string, extra?: React.ReactNode) => (
    <div className="flex items-center gap-3 border-b border-zinc-100 py-2.5 last:border-0">
      <span className={`grid min-w-16 place-items-center rounded-lg px-2 py-2 text-[10px] font-bold ${tone}`}>{code}</span>
      <span className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="text-xs text-zinc-500">{meta}</p></span>
      {extra}
    </div>
  );
  if (step === 0) {
    return (
      <>
        <p className="text-lg font-bold">Good morning, Terrier</p>
        <p className="text-xs text-zinc-500">Monday · You&apos;ve got this.</p>
        <div className="my-3 flex items-center gap-3 rounded-xl bg-red-50 p-3 text-bu">
          <IconSparkle size={22} />
          <span><p className="text-sm font-semibold text-zinc-900">Your semester, in one place.</p><p className="text-xs">5 courses · 18 credits · Fall 2026</p></span>
        </div>
        <p className="text-xs font-semibold text-zinc-500">Up next</p>
        {row("bg-sky-600", "MA 225 Multivariate Calculus", "9:05 – 9:55 am · CAS 522")}
        {row("bg-violet-600", "EC 327 Software Engineering", "12:20 – 2:05 pm · PHO 203")}
        <div className="mt-2 grid grid-cols-4 gap-2 border-t border-zinc-100 pt-3 text-zinc-500">
          {[IconCalendar, IconLayers, IconSparkle, IconFood].map((I, i) => <span key={i} className="grid h-10 place-items-center rounded-lg bg-zinc-50"><I size={18} /></span>)}
        </div>
      </>
    );
  }
  if (step === 1) {
    return (
      <>
        <div className="mb-1 flex items-center justify-between"><p className="text-lg font-bold">Fall 2026</p><span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Live sections</span></div>
        {chip("MA 225", "bg-sky-50 text-sky-700", "Multivariate Calculus", "A1 · MWF 9:05 · 4 credits")}
        {chip("EC 327", "bg-violet-50 text-violet-700", "Intro to Software Eng.", "A1 + lab C2 · 4 credits")}
        {chip("WR 153", "bg-emerald-50 text-emerald-700", "Writing & Research", "Pick a section…", <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Clashes MA 225</span>)}
        <div className="mt-2 rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600">📄 Syllabus added: Midterm 2 on Thu Nov 5 is on your calendar, with reminders.</div>
      </>
    );
  }
  if (step === 2) {
    return (
      <>
        <p className="text-lg font-bold">Monday</p>
        <p className="mb-2 text-xs text-bu">Leave by 8:56 am · 4 min walk</p>
        {[["bg-sky-50 border-sky-500", "MA 225 · Class", "9:05 – 9:55 am"], ["bg-amber-50 border-amber-400", "Lunch", "11:00 – 11:45 am"], ["bg-violet-50 border-violet-500", "Study for MA 226 Midterm 2", "2:15 – 3:45 pm"], ["bg-emerald-50 border-emerald-500", "Gym", "5:30 – 6:30 pm"]].map(([c, t, m]) => (
          <div key={t} className={`mb-1.5 rounded-lg border-l-4 px-3 py-2 ${c}`}><p className="text-sm font-semibold">{t}</p><p className="text-xs text-zinc-600">{m}</p></div>
        ))}
      </>
    );
  }
  if (step === 3) {
    return (
      <>
        <div className="ml-auto mb-3 w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-100 px-3 py-2 text-sm">Is there a morning WR 153 section? Add it.</div>
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-bu"><IconSparkle size={14} /> CampusWizard</p>
        <p className="text-sm">Yes: <b>K1</b>, Tue/Thu 9:30 – 10:45 am with Michaud. I&apos;ve added it, and it doesn&apos;t clash with anything.</p>
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">✓ Schedule updated: MA 225, EC 327, WR 153 (12 units)</p>
      </>
    );
  }
  return (
    <div className="py-2 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-bu"><IconSparkle size={24} /></span>
      <p className="font-semibold">A little more ready.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-left">
        {[["6", "majors"], ["7,682", "BU courses"], ["live", "trains"]].map(([n, l]) => (
          <span key={l} className="rounded-xl bg-zinc-50 p-2.5"><p className="text-lg font-bold">{n}</p><p className="text-[11px] text-zinc-500">{l}</p></span>
        ))}
      </div>
    </div>
  );
}

const INTRO = [
  { eyebrow: "A calmer kind of campus life", title: "Welcome to CampusWizard", body: "Your personal academic assistant. One thoughtful workspace for your courses, your week, and everything in between." },
  { eyebrow: "Make room for what's next", title: "Semester Planner", body: "Search any BU course, pick the section you want, and see clashes before you add it. Upload a syllabus and every exam and assignment lands on your calendar." },
  { eyebrow: "A week that fits", title: "Weekly Planner", body: "Classes, clubs, study blocks and your to-dos in one week, with leave-by times that use live Green Line trains and the weather." },
  { eyebrow: "A little clarity, on demand", title: "AI Assistant", body: "Ask CampusWizard anything. It can see your schedule, find sections, plan your week, and log what you spend." },
  { eyebrow: "Your semester, thoughtfully organized", title: "Get started", body: "Explore with a sample student first, or create an account to plan your own semester. You can replay this tour from your account anytime." },
];

// ---------- part 2: coach marks on the tabs ----------

const MARKS = [
  { target: "tab-home", title: "Home", body: "Your day at a glance: today's classes, when to leave, and what to study first." },
  { target: "tab-plan", title: "Semester", body: "Build your schedule section by section, see clashes before you add, and upload syllabi for exams and homework." },
  { target: "tab-week", title: "Week", body: "Plan your week around classes and club meetings, then send it to Google or Apple Calendar." },
  { target: "tab-chat", title: "AI Chat", body: "Ask CampusWizard. It can see your calendar and add, drop or find classes for you." },
  { target: "tab-money", title: "Money & Food", body: "Track your semester budget from receipts and bank exports. Food shows dining halls and the cheapest delivery app." },
];

export function WorkspaceTour() {
  const path = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState<"off" | "intro" | "marks">("off");
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!seen() && !HIDE_ON.includes(path) && !new URLSearchParams(window.location.search).has("setup")) setPhase("intro");
    const replay = () => { setStep(0); setPhase("intro"); };
    window.addEventListener("cw:tour", replay);
    return () => window.removeEventListener("cw:tour", replay);
    // first visit only; replays come through the event
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => { markSeen(); setPhase("off"); setStep(0); }, []);

  // keep the spotlight on its tab (and follow resizes / rotation)
  useLayoutEffect(() => {
    if (phase !== "marks") return;
    const measure = () => setRect(document.querySelector(`[data-tour="${MARKS[step].target}"]`)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [phase, step]);

  useEffect(() => {
    if (phase === "off") return;
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, step, close]);

  if (phase === "off") return null;

  const dots = (n: number) => (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <span key={i} className={`h-2.5 w-2.5 rounded-full border-2 border-bu transition-colors ${i === step ? "bg-bu" : "bg-transparent"}`} />)}
    </div>
  );

  if (phase === "intro") {
    const s = INTRO[step];
    const last = step === INTRO.length - 1;
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="cw-tour-title" className="fixed inset-0 z-50 overflow-y-auto bg-[#f7f7f5]">
        <div className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-8 pt-6">
          <div className="flex items-center justify-between">
            <LogoTile size={36} />
            <button onClick={close} className="text-sm text-zinc-500 hover:text-zinc-800">Skip introduction →</button>
          </div>
          <div key={step} className="cw-enter">
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-wider text-bu">{s.eyebrow}</p>
            <h2 id="cw-tour-title" className="mt-2 text-[32px] font-bold leading-tight tracking-tight">{s.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">{s.body}</p>
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><Preview step={step} /></div>
          </div>
          <div className="mt-auto pt-6">
            <div className="mb-4 flex items-center justify-between">{dots(INTRO.length)}<span className="text-xs text-zinc-500">{step + 1} of {INTRO.length}</span></div>
            {last ? (
              <div className="space-y-2">
                <button ref={nextRef} onClick={() => { setStep(0); setPhase("marks"); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-bu text-sm font-semibold text-white hover:bg-red-700">
                  <IconArrowRight size={18} /> Show me around
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { close(); router.push("/"); }} className="min-h-11 rounded-xl border border-zinc-300 bg-white text-sm font-semibold">Explore the sample</button>
                  <button onClick={() => { close(); router.push("/account"); }} className="min-h-11 rounded-xl border border-zinc-300 bg-white text-sm font-semibold">Create my account</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="min-h-12 rounded-xl bg-zinc-200/70 px-5 text-sm font-semibold text-zinc-700 disabled:opacity-40">Back</button>
                <button ref={nextRef} onClick={() => setStep(step + 1)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-bu text-sm font-semibold text-white hover:bg-red-700">
                  <IconArrowRight size={18} /> Next
                </button>
              </div>
            )}
            <p className="mt-5 text-center text-xs text-zinc-400">Your semester. Thoughtfully organized.</p>
          </div>
        </div>
      </div>
    );
  }

  // coach marks: dim everything, cut a hole around the tab, card above the nav pointing at it
  const m = MARKS[step];
  const pad = 6;
  const last = step === MARKS.length - 1;
  const arrowX = rect ? rect.left + rect.width / 2 : 0;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cw-mark-title" className="fixed inset-0 z-50">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-bu transition-all duration-300"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(15,15,15,0.55)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}
      <div className="absolute inset-x-0 mx-auto max-w-md px-4" style={{ bottom: rect ? window.innerHeight - rect.top + 18 : 120 }}>
        <div className="relative rounded-2xl bg-white p-5 shadow-xl cw-enter" key={step}>
          {rect && <span className="absolute -bottom-2 h-4 w-4 rotate-45 bg-white" style={{ left: Math.max(16, Math.min(arrowX - 8 - Math.max(0, (window.innerWidth - 448) / 2) - 16, 448 - 48)) }} />}
          <div className="flex items-start justify-between">
            <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">Workspace tour · {step + 1} of {MARKS.length}</span>
            <button onClick={close} aria-label="Close tour" className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100">✕</button>
          </div>
          <h2 id="cw-mark-title" className="mt-3 text-xl font-bold">{m.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{m.body}</p>
          <div className="mt-4 flex items-center justify-between">{dots(MARKS.length)}</div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => (step === 0 ? setPhase("intro") : setStep(step - 1))} className="min-h-11 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-700">Previous</button>
            <button ref={nextRef} onClick={() => (last ? close() : setStep(step + 1))} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-bu text-sm font-semibold text-white hover:bg-red-700">
              {last ? "Start exploring" : <><IconArrowRight size={18} /> Next</>}
            </button>
          </div>
          <button onClick={close} className="mt-3 w-full text-center text-xs text-zinc-500">Skip tour</button>
        </div>
      </div>
    </div>
  );
}
