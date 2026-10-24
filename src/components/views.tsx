"use client";
import { useState } from "react";
import { Card, Pill } from "@/components/ui";
import { fmtTime, money } from "@/lib/format";
import type { Course, Day, EventKind, FoodComparison, SemesterPlanResponse, WeekEvent, WeekPlanResponse } from "@/lib/types";
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

export function SemesterView({ plan }: { plan: SemesterPlanResponse }) {
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
    </div>
  );
}

// ---------- week ----------

const KIND_STYLE: Record<EventKind, string> = {
  class: "border-l-red-500 bg-red-50",
  club: "border-l-violet-500 bg-violet-50",
  exam: "border-l-orange-500 bg-orange-50",
  study: "border-l-sky-500 bg-sky-50",
  gym: "border-l-emerald-500 bg-emerald-50",
  meal: "border-l-amber-400 bg-amber-50",
  task: "border-l-pink-500 bg-pink-50",
  sleep: "border-l-zinc-400 bg-zinc-100",
  travel: "border-l-zinc-400 bg-zinc-50",
};

export function WeekView({ plan }: { plan: WeekPlanResponse }) {
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [day, setDay] = useState<Day>(DAYS[todayIdx]);
  const events = plan.events.filter((e) => e.day === day);
  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto">
        {DAYS.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${d === day ? "bg-bu text-white" : "bg-white text-zinc-600 border border-zinc-200"}`}
          >
            {d}
          </button>
        ))}
      </div>
      <ul className="space-y-1.5">
        {events.map((e) => <EventRow key={e.id} e={e} />)}
        {events.length === 0 && <li className="text-sm text-zinc-500">Nothing planned.</li>}
      </ul>
      {plan.unscheduled.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Couldn&apos;t fit: {plan.unscheduled.join(", ")}</p>
      )}
    </div>
  );
}

export function EventRow({ e }: { e: WeekEvent }) {
  return (
    <li className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 ${KIND_STYLE[e.kind]}`}>
      <span className="w-[68px] shrink-0 text-xs tabular-nums text-zinc-500">{fmtTime(e.start)}</span>
      <span className="text-sm font-medium">{e.title}</span>
      {e.location && <span className="ml-auto text-xs text-zinc-500">{e.location}</span>}
    </li>
  );
}

// ---------- food ----------

export function FoodView({ data, onOrder }: { data: FoodComparison[]; onOrder?: (r: FoodComparison) => void }) {
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
                <span className="tabular-nums" title={`Subtotal ${money(q.subtotal)} + delivery ${money(q.deliveryFee)} + service ${money(q.serviceFee)} + small order ${money(q.smallOrderFee)} + tax ${money(q.tax)}`}>
                  {money(q.total)} <span className="text-xs font-normal text-zinc-400">{q.etaMinutes}m</span>
                </span>
              </li>
            ))}
          </ul>
          {onOrder && (
            <button onClick={() => onOrder(r)} className="mt-2 w-full rounded-lg border border-zinc-200 py-1.5 text-xs font-semibold text-bu">
              I ordered on {r.cheapest}: log {money(r.quotes[0].total)}
            </button>
          )}
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
