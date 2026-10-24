"use client";
import { useState } from "react";
import { IconCalendar, IconPin } from "@/components/icons";
import { Card, EmptyState, Pill } from "@/components/ui";
import { orderUrl } from "@/lib/food";
import { fmtTime, money } from "@/lib/format";
import type { Course, Day, DiningHallToday, DiningRecommendation, EventKind, FoodComparison, SemesterPlanResponse, WeekEvent, WeekPlanResponse } from "@/lib/types";
import { DAYS } from "@/lib/types";

// ---------- semester ----------

const WEEKDAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const COURSE_COLORS = ["bg-red-100 border-red-300", "bg-sky-100 border-sky-300", "bg-amber-100 border-amber-300", "bg-emerald-100 border-emerald-300", "bg-violet-100 border-violet-300", "bg-pink-100 border-pink-300"];

/** Mon–Fri grid, 8 am to 9 pm, one colored block per section meeting. */
function ClassGrid({ plan }: { plan: SemesterPlanResponse }) {
  const start = 8 * 60, end = 21 * 60, height = 260;
  const y = (m: number) => ((m - start) / (end - start)) * height;
  return (
    <div className="grid grid-cols-[28px_repeat(5,1fr)] gap-1 text-[10px]">
      <div className="relative" style={{ height }}>
        {[8, 11, 14, 17, 20].map((h) => (
          <span key={h} className="absolute -translate-y-1/2 text-zinc-400" style={{ top: y(h * 60) }}>{h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}</span>
        ))}
      </div>
      {WEEKDAYS.map((d) => (
        <div key={d} className="relative rounded-md bg-zinc-50" style={{ height }}>
          <span className="absolute inset-x-0 -top-4 text-center font-medium text-zinc-500">{d}</span>
          {plan.courses.flatMap((c, i) =>
            c.sections
              .filter((s) => s.schedule.days.includes(d) && s.schedule.start != null)
              .map((s) => (
                <div
                  key={`${c.code}${s.section}`}
                  className={`absolute inset-x-0.5 overflow-hidden rounded border px-0.5 leading-tight ${COURSE_COLORS[i % COURSE_COLORS.length]}`}
                  style={{ top: y(s.schedule.start!), height: Math.max(12, y(s.schedule.end!) - y(s.schedule.start!)) }}
                  title={`${c.code} ${s.section} ${s.schedule.raw} ${s.location}`}
                >
                  {c.code.split(" ").slice(1).join(" ")}
                </div>
              )),
          )}
        </div>
      ))}
    </div>
  );
}

export function SemesterView({ plan, onUse }: { plan: SemesterPlanResponse; onUse?: () => void }) {
  return (
    <div className="space-y-3">
      <Card>
        <div className="mb-5 flex items-baseline justify-between">
          <h3 className="font-semibold">{plan.term}</h3>
          <Pill tone="red">{plan.totalUnits} units</Pill>
        </div>
        <ClassGrid plan={plan} />
      </Card>
      {plan.courses.map((c) => (
        <Card key={c.code} className="!p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{c.code} · {c.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{c.reason}</p>
            </div>
            <Pill>{c.units}u</Pill>
          </div>
          {c.sections.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-zinc-600">
              {c.sections.map((s) => (
                <li key={s.section}>
                  <span className="font-mono">{s.section}</span> {s.schedule.raw} · {s.location} {s.instructor && `· ${s.instructor}`}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      {plan.blocked.length > 0 && (
        <Card className="!p-3">
          <p className="mb-1 text-sm font-semibold">Not yet</p>
          <ul className="space-y-1 text-xs text-zinc-600">
            {plan.blocked.map((b) => (
              <li key={b.code}><span className="font-medium">{b.code}</span> {b.title}: needs {b.missing.join(", ")}</li>
            ))}
          </ul>
        </Card>
      )}
      {plan.warnings.map((w) => (
        <p key={w} className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{w}</p>
      ))}
      {onUse && (
        <button onClick={onUse} className="w-full rounded-xl bg-bu py-2 text-sm font-semibold text-white">Use this as my schedule</button>
      )}
    </div>
  );
}

// ---------- week ----------

const KIND_STYLE: Record<EventKind, { card: string; label: string; text: string }> = {
  class: { card: "border-sky-500 bg-sky-50", label: "Class", text: "text-sky-800" },
  club: { card: "border-violet-500 bg-violet-50", label: "Club", text: "text-violet-800" },
  exam: { card: "border-red-500 bg-red-50", label: "Exam", text: "text-red-800" },
  study: { card: "border-indigo-400 bg-indigo-50/70", label: "Study", text: "text-indigo-800" },
  gym: { card: "border-emerald-500 bg-emerald-50", label: "Exercise", text: "text-emerald-800" },
  meal: { card: "border-amber-400 bg-amber-50", label: "Meal", text: "text-amber-800" },
  task: { card: "border-pink-500 bg-pink-50", label: "To-do", text: "text-pink-800" },
  sleep: { card: "border-zinc-300 bg-zinc-50", label: "Sleep", text: "text-zinc-600" },
  travel: { card: "border-zinc-300 bg-zinc-50", label: "Travel", text: "text-zinc-600" },
};

const dateOf = (weekOf: string, i: number) => {
  const [y, m, d] = weekOf.split("-").map(Number);
  return new Date(y, m - 1, d + i);
};
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const freeLabel = (mins: number) => (mins < 60 ? `${mins} minutes` : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`);

/** "Your week, in perspective": day strip, a timeline for the chosen day, and a balanced-week summary. */
export function WeekView({ plan }: { plan: WeekPlanResponse }) {
  const today = new Date();
  const todayIdx = DAYS.findIndex((_, i) => plan.weekOf && sameDay(dateOf(plan.weekOf, i), today));
  const [day, setDay] = useState<Day>(DAYS[todayIdx >= 0 ? todayIdx : 0]);
  const di = DAYS.indexOf(day);
  const date = plan.weekOf ? dateOf(plan.weekOf, di) : null;
  const isToday = date ? sameDay(date, today) : false;
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const events = plan.events.filter((e) => e.day === day && e.kind !== "sleep").sort((a, b) => a.start - b.start);
  const sleep = plan.events.find((e) => e.day === day && e.kind === "sleep");

  const hours = (k: EventKind) => plan.events.filter((e) => e.kind === k).reduce((m, e) => m + (e.end - e.start), 0) / 60;
  const stats = [
    [String(plan.events.filter((e) => e.kind === "class").length), "Class sessions"],
    [`${Math.round(hours("class") * 10) / 10}h`, "In class"],
    [`${Math.round(hours("study") * 10) / 10}h`, "Study"],
    [String(plan.events.filter((e) => e.kind === "task" || e.kind === "gym").length), "To-dos"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Day of the week">
        {DAYS.map((d, i) => {
          const dd = plan.weekOf ? dateOf(plan.weekOf, i) : null;
          const sel = d === day;
          return (
            <button
              key={d}
              role="tab"
              aria-selected={sel}
              onClick={() => setDay(d)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-xl text-xs transition-colors duration-150 ${sel ? "bg-bu text-white shadow-sm" : "border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"}`}
            >
              <span className={sel ? "text-white/85" : ""}>{d}</span>
              <span className={`text-base font-bold ${sel ? "" : "text-zinc-900"}`}>{dd ? dd.getDate() : ""}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{date ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : day}</h3>
        {isToday && <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-bu">Today</span>}
      </div>

      {events.length === 0 ? (
        <Card><EmptyState icon={<IconCalendar size={20} />} title="An open day ahead." body="Nothing is scheduled for this day." /></Card>
      ) : (
        <ol className="space-y-2">
          {events.map((e, i) => {
            const st = KIND_STYLE[e.kind];
            const prev = events[i - 1];
            const free = prev ? e.start - prev.end : 0;
            const showNow = isToday && nowMin >= (prev?.end ?? 0) && nowMin < e.start;
            return (
              <li key={e.id}>
                {free >= 45 && <p className="mb-2 pl-16 text-xs text-zinc-400">{freeLabel(free)} free · A moment to reset</p>}
                {showNow && (
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-bu" aria-label="Current time">
                    <span className="w-14 text-right">{fmtTime(nowMin)}</span><span className="h-px flex-1 bg-bu" />
                  </div>
                )}
                <div className="flex gap-3">
                  <span className="w-14 shrink-0 pt-2 text-right text-xs font-semibold leading-tight text-zinc-800">
                    {fmtTime(e.start).replace(/ (am|pm)/, "")}
                    <span className="block text-[10px] font-normal text-zinc-400">{fmtTime(e.start).slice(-2).toUpperCase()}</span>
                  </span>
                  <div className={`flex-1 rounded-xl border-l-[3px] px-3.5 py-2.5 ${st.card}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${st.text}`}>{st.label}</p>
                    <p className="font-semibold text-zinc-900">{e.title}</p>
                    <p className={`text-xs ${st.text}`}>{fmtTime(e.start)} – {fmtTime(e.end)}</p>
                    {e.location && <p className={`mt-0.5 flex items-center gap-1 text-xs ${st.text}`}><IconPin size={13} /> {e.location}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {sleep && <p className="pl-16 text-xs text-zinc-400">Lights out by {fmtTime(sleep.start)} for a full night&apos;s sleep.</p>}

      {plan.unscheduled.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Couldn&apos;t fit this week: {plan.unscheduled.join(", ")}. Try fewer study hours or to-dos.</p>
      )}

      <Card className="!p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold"><span className="text-bu">▮▮▮</span> A balanced view of your week</p>
        <div className="grid grid-cols-4 gap-2">
          {stats.map(([n, l]) => <div key={l}><p className="text-xl font-bold tracking-tight">{n}</p><p className="text-[11px] text-zinc-500">{l}</p></div>)}
        </div>
      </Card>
    </div>
  );
}

export function EventRow({ e }: { e: WeekEvent }) {
  const st = KIND_STYLE[e.kind];
  return (
    <li className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 ${st.card}`}>
      <span className="w-[68px] shrink-0 text-xs tabular-nums text-zinc-500">{fmtTime(e.start)}</span>
      <span className="text-sm font-medium">{e.title}</span>
      {e.location && <span className="ml-auto text-xs text-zinc-500">{e.location}</span>}
    </li>
  );
}

// ---------- food ----------

const promoOf = (q: FoodComparison["quotes"][number]) =>
  Math.max(0, Math.round((q.subtotal + q.deliveryFee + q.serviceFee + q.smallOrderFee + q.tax - q.total) * 100) / 100);

/** Fee-by-fee table so it's clear where each app's price comes from (promotions make the columns add up). */
function FeeTable({ r }: { r: FoodComparison }) {
  const rows: [string, (q: FoodComparison["quotes"][number]) => number][] = [
    ["Food", (q) => q.subtotal],
    ["Delivery", (q) => q.deliveryFee],
    ["Service", (q) => q.serviceFee],
    ["Small order / bag", (q) => q.smallOrderFee],
    ["Tax", (q) => q.tax],
  ];
  const promos = r.quotes.some((q) => promoOf(q) > 0.05);
  return (
    <table className="mt-2 w-full text-xs tabular-nums">
      <thead>
        <tr className="text-zinc-500">
          <th className="py-1 text-left font-medium" />
          {r.quotes.map((q) => <th key={q.app} className="py-1 text-right font-medium">{q.app}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, get]) => (
          <tr key={label} className="border-t border-zinc-100">
            <td className="py-1 text-zinc-500">{label}</td>
            {r.quotes.map((q) => <td key={q.app} className="py-1 text-right">{money(get(q))}</td>)}
          </tr>
        ))}
        {promos && (
          <tr className="border-t border-zinc-100 text-green-700">
            <td className="py-1">Promotions</td>
            {r.quotes.map((q) => <td key={q.app} className="py-1 text-right">{promoOf(q) > 0.05 ? `−${money(promoOf(q))}` : "—"}</td>)}
          </tr>
        )}
        <tr className="border-t border-zinc-200 font-semibold">
          <td className="py-1">Total</td>
          {r.quotes.map((q) => <td key={q.app} className="py-1 text-right">{money(q.total)}</td>)}
        </tr>
      </tbody>
    </table>
  );
}

export function FoodView({ data, onOrder }: { data: FoodComparison[]; onOrder?: (r: FoodComparison) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const checked = data.flatMap((r) => r.quotes.map((q) => q.checkedAt)).sort().at(-1);
  return (
    <div className="space-y-3">
      {data.map((r) => (
        <Card key={r.restaurant} className="!p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <div>
              <p className="font-semibold">{r.restaurant}</p>
              <p className="text-xs text-zinc-500">{r.items}</p>
            </div>
            {r.savings > 0 && <Pill tone="green">Save {money(r.savings)}</Pill>}
          </div>
          <ul className="space-y-1">
            {r.quotes.map((q, i) => (
              <li key={q.app} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${i === 0 ? "bg-green-50 font-semibold" : ""}`}>
                <span>
                  {q.app} {i === 0 && <span className="text-xs text-green-700">· cheapest</span>}
                  {q.acceptsConveniencePoints && <span className="ml-1 text-xs text-bu">· Convenience Points</span>}
                </span>
                <span className="tabular-nums">
                  {money(q.total)} <span className="text-xs font-normal text-zinc-400">{q.etaMinutes}m</span>
                </span>
              </li>
            ))}
          </ul>
          <button onClick={() => setOpen(open === r.restaurant ? null : r.restaurant)} className="mt-1 text-xs font-medium text-zinc-500">
            {open === r.restaurant ? "Hide fees ▲" : "Compare fees ▼"}
          </button>
          {open === r.restaurant && <FeeTable r={r} />}
          <a
            href={orderUrl(r.cheapest, r.restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-bu text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Order on {r.cheapest} for {money(r.quotes[0].total)} ↗
          </a>
          <p className="mt-1.5 text-center text-[11px] text-zinc-400">
            Or open{" "}
            {r.quotes.slice(1).map((q, i) => (
              <span key={q.app}>
                {i > 0 && " · "}
                <a href={orderUrl(q.app, r.restaurant)} target="_blank" rel="noopener noreferrer" className="underline">{q.app}</a>
              </span>
            ))}
          </p>
          {onOrder && (
            <button onClick={() => onOrder(r)} className="mt-2 w-full rounded-lg border border-zinc-200 py-1.5 text-xs font-semibold text-zinc-700">
              Ordered? Log {money(r.quotes[0].total)} in my budget
            </button>
          )}
        </Card>
      ))}
      {checked && (
        <p className="text-center text-[11px] text-zinc-400">
          Same order, same address near campus. Totals include fees, tax and any promotions shown at checkout on{" "}
          {new Date(checked).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.
        </p>
      )}
    </div>
  );
}

// ---------- dining halls ----------

const MEAL_TAG_TONE: Record<string, "green" | "amber" | "zinc"> = { vegan: "green", vegetarian: "green", halal: "amber", "gluten-free": "zinc" };

/** One dining hall card: open-now status, today's hours and today's menu grouped by station. */
export function DiningHallCard({ hall }: { hall: DiningHallToday }) {
  const byStation = hall.items.reduce<Record<string, typeof hall.items>>((acc, it) => {
    (acc[it.station] ??= []).push(it);
    return acc;
  }, {});
  return (
    <Card className="!p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{hall.hall.name}</p>
          <p className="text-xs text-zinc-500">{hall.hall.campus} Campus · {hall.hall.style}</p>
        </div>
        <Pill tone={hall.openNow ? "green" : "zinc"}>{hall.openNow ? "Open now" : "Closed"}</Pill>
      </div>

      <p className="mt-2 text-xs text-zinc-600">
        {hall.hours.length === 0
          ? "Closed today"
          : hall.hours.map((p) => `${p.name} ${fmtTime(p.start)}–${fmtTime(p.end)}`).join(" · ")}
      </p>
      {hall.currentPeriod && hall.hours.length > 0 && (
        <p className="mt-0.5 text-[11px] text-bu">{hall.openNow ? `Serving ${hall.currentPeriod} now` : `Next: ${hall.currentPeriod}`}</p>
      )}

      {hall.hall.features.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {hall.hall.features.map((f) => <Pill key={f}>{f}</Pill>)}
        </div>
      )}

      {hall.items.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-zinc-500">Sample menu</p>
          {Object.entries(byStation).map(([station, items]) => (
            <div key={station}>
              <p className="text-[11px] font-semibold text-zinc-400">{station}</p>
              <ul className="space-y-0.5">
                {items.map((it) => (
                  <li key={it.name} className="flex flex-wrap items-center gap-1 text-sm">
                    <span>{it.name}</span>
                    {it.tags.map((t) => <Pill key={t} tone={MEAL_TAG_TONE[t] ?? "zinc"}>{t}</Pill>)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">No menu posted for today.</p>
      )}

      <a href={hall.hall.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-bu">BU Dining page →</a>
    </Card>
  );
}

export function DiningView({ halls }: { halls: DiningHallToday[] }) {
  if (halls.length === 0) return <p className="text-sm text-zinc-500">No dining halls to show.</p>;
  return (
    <div className="space-y-3">
      {halls.map((h) => <DiningHallCard key={h.hall.id} hall={h} />)}
    </div>
  );
}

export function DiningRecommendations({ recs }: { recs: DiningRecommendation[] }) {
  if (recs.length === 0) return null;
  return (
    <div className="space-y-2">
      {recs.map((r) => (
        <Card key={r.hallId} className="!p-3">
          <p className="font-semibold">{r.hallName}</p>
          {r.why && <p className="mt-0.5 text-xs text-zinc-500">{r.why}</p>}
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {r.items.map((it) => <li key={it}><Pill tone="red">{it}</Pill></li>)}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ---------- course ----------

export function CourseView({ course }: { course: Course }) {
  return (
    <Card className="!p-3">
      <p className="font-semibold">{course.code} · {course.title}</p>
      {course.prereqText && <p className="mt-1 text-xs text-zinc-600"><span className="font-medium">Prereqs:</span> {course.prereqText}</p>}
      {course.coreqText && <p className="text-xs text-zinc-600"><span className="font-medium">Coreqs:</span> {course.coreqText}</p>}
      {course.hub.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{course.hub.map((h) => <Pill key={h}>{h}</Pill>)}</div>}
      <p className="mt-2 line-clamp-3 text-xs text-zinc-500">{course.description}</p>
      <a href={course.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-bu">BU course page →</a>
    </Card>
  );
}
