"use client";
import { fmtTime } from "@/lib/format";
import { conflicts, shortCode } from "@/lib/schedule";
import { sectionsOverlap } from "@/lib/sections";
import type { Day, PlannedCourse, Section } from "@/lib/types";

const COLORS = [
  "bg-sky-100 border-sky-400 text-sky-900",
  "bg-amber-100 border-amber-400 text-amber-900",
  "bg-emerald-100 border-emerald-400 text-emerald-900",
  "bg-violet-100 border-violet-400 text-violet-900",
  "bg-pink-100 border-pink-400 text-pink-900",
  "bg-teal-100 border-teal-400 text-teal-900",
  "bg-orange-100 border-orange-400 text-orange-900",
];
export const courseColor = (i: number) => COLORS[i % COLORS.length];

const START = 8 * 60, END = 22 * 60;

/**
 * Weekly grid of the picked sections. Overlapping sections get a red outline,
 * and `preview` (the section being looked at) shows dashed so clashes are visible before adding.
 */
export function ScheduleCalendar({
  courses,
  preview,
  selected,
  onSelect,
  scale = 0.6,
}: {
  courses: PlannedCourse[];
  preview?: { code: string; sections: Section[] } | null;
  selected?: string | null;
  onSelect?: (code: string) => void;
  scale?: number; // pixels per minute
}) {
  const PX_PER_MIN = scale;
  const y = (m: number) => (Math.max(START, Math.min(END, m)) - START) * PX_PER_MIN;
  const clash = new Set<Section>();
  for (const c of conflicts(courses)) {
    clash.add(c.aSection);
    clash.add(c.bSection);
  }
  const others = courses.filter((c) => c.code !== preview?.code);
  const previewClash = (s: Section) => others.some((c) => c.sections.some((x) => sectionsOverlap(x, s)));
  const weekend = [...courses.flatMap((c) => c.sections), ...(preview?.sections ?? [])].some((s) =>
    s.schedule.days.some((d) => d === "Sat" || d === "Sun"),
  );
  const days: Day[] = weekend ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const height = (END - START) * PX_PER_MIN;

  return (
    <div className="grid gap-px text-[10px]" style={{ gridTemplateColumns: `26px repeat(${days.length}, 1fr)` }}>
      <div />
      {days.map((d) => (
        <div key={d} className="pb-1 text-center font-semibold text-zinc-500">{d}</div>
      ))}
      <div className="relative" style={{ height }}>
        {Array.from({ length: (END - START) / 60 + 1 }, (_, i) => START / 60 + i).map((h) => (
          <span key={h} className="absolute right-1 -translate-y-1/2 text-zinc-400" style={{ top: y(h * 60) }}>
            {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "a" : "p"}
          </span>
        ))}
      </div>
      {days.map((d) => (
        <div key={d} className="relative rounded-md bg-zinc-50" style={{ height }}>
          {Array.from({ length: (END - START) / 60 }, (_, i) => (
            <div key={i} className="absolute inset-x-0 border-t border-zinc-200/70" style={{ top: i * 60 * PX_PER_MIN }} />
          ))}
          {courses.flatMap((c, i) =>
            c.code === preview?.code
              ? []
              : c.sections
                  .filter((s) => s.schedule.days.includes(d) && s.schedule.start != null)
                  .map((s) => (
                    <button
                      key={`${c.code}${s.section}${s.schedule.raw}`}
                      onClick={() => onSelect?.(c.code)}
                      title={`${c.code} ${s.section} · ${s.schedule.raw} · ${s.location} · ${s.instructor}`}
                      className={`absolute inset-x-0.5 overflow-hidden rounded border-l-[3px] px-0.5 text-left leading-tight ${courseColor(i)} ${clash.has(s) ? "ring-2 ring-red-500 z-10" : ""} ${selected === c.code ? "ring-2 ring-zinc-900" : ""}`}
                      style={{ top: y(s.schedule.start!), height: Math.max(14, y(s.schedule.end!) - y(s.schedule.start!)) }}
                    >
                      <span className="font-semibold">{shortCode(c.code)}</span> {s.section}
                      <br />
                      <span className="opacity-70">{fmtTime(s.schedule.start!).replace(" ", "")}</span>
                    </button>
                  )),
          )}
          {preview?.sections
            .filter((s) => s.schedule.days.includes(d) && s.schedule.start != null)
            .map((s) => (
              <div
                key={`p${s.section}${s.schedule.raw}`}
                className={`pointer-events-none absolute inset-x-0.5 z-20 overflow-hidden rounded border-2 border-dashed px-0.5 leading-tight ${previewClash(s) ? "border-red-500 bg-red-100/80 text-red-800" : "border-zinc-800 bg-white/80 text-zinc-800"}`}
                style={{ top: y(s.schedule.start!), height: Math.max(14, y(s.schedule.end!) - y(s.schedule.start!)) }}
              >
                <span className="font-semibold">{shortCode(preview.code)}</span> {s.section}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
