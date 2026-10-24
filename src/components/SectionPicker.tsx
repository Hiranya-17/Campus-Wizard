"use client";
import { useEffect, useMemo, useState } from "react";
import { Pill } from "@/components/ui";
import { clashesWith, shortCode } from "@/lib/schedule";
import { sectionOptions, type Unit } from "@/lib/sections";
import type { Course, PlannedCourse, Section } from "@/lib/types";

/** Prerequisite groups not covered by `completed`, as readable strings. */
export function missingPrereqs(course: Course, completed: string[]): string[] {
  const have = new Set(completed);
  return course.prereqs.filter((alts) => !alts.some((c) => have.has(c))).map((alts) => alts.map(shortCode).join(" or "));
}

function UnitRow({ unit, picked, clashes, onPick }: { unit: Unit; picked: boolean; clashes: string[]; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition ${picked ? "border-bu bg-red-50" : "border-zinc-200 bg-white hover:border-zinc-400"}`}
    >
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${picked ? "border-bu bg-bu text-[9px] text-white" : "border-zinc-300"}`}>{picked ? "✓" : ""}</span>
      <span className="w-7 shrink-0 font-mono font-semibold">{unit[0].section}</span>
      <span className="min-w-0 flex-1">
        {unit.map((s, i) => (
          <span key={i} className="block">
            <span className="font-medium">{s.schedule.raw || "Time TBA"}</span>
            <span className="text-zinc-500"> · {s.location || "TBA"}</span>
          </span>
        ))}
        <span className="block truncate text-zinc-500">{unit[0].instructor || "Staff"}</span>
      </span>
      {clashes.length > 0 && <Pill tone="red">Clashes {clashes.map(shortCode).join(", ")}</Pill>}
    </button>
  );
}

/**
 * Every section of a course for the term. Pick a lecture (or the only section), then one of each
 * discussion/lab it needs; the parent previews the picks on the calendar as they change.
 */
export function SectionPicker({
  course,
  term,
  schedule,
  completed,
  onPreview,
  onAdd,
  onClose,
  onSwitchTerm,
}: {
  course: Course;
  term: string;
  schedule: PlannedCourse[];
  completed: string[];
  onPreview: (sections: Section[] | null) => void;
  onAdd: (course: PlannedCourse) => void;
  onClose: () => void;
  onSwitchTerm?: () => void;
}) {
  const termSections = useMemo(() => course.sections.filter((s) => s.term === term), [course, term]);
  const options = useMemo(() => sectionOptions(termSections), [termSections]);
  const existing = schedule.find((c) => c.code === course.code);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [companionIds, setCompanionIds] = useState<Record<string, string>>({});

  // Start from what's already in the schedule, so "Change" shows the current picks
  useEffect(() => {
    if (!existing) return;
    const ids = new Set(existing.sections.map((s) => s.section));
    const opt = options.find((o) => ids.has(o.primary[0].section));
    if (!opt) return;
    setPrimaryId(opt.primary[0].section);
    setCompanionIds(Object.fromEntries(opt.companions.map((g) => [g.label + g.choices[0][0].section, g.choices.find((u) => ids.has(u[0].section))?.[0].section ?? ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.code]);

  const option = options.find((o) => o.primary[0].section === primaryId) ?? null;
  const groupKey = (g: { label: string; choices: Unit[] }) => g.label + g.choices[0][0].section;
  const chosen: Section[] = option
    ? [...option.primary, ...option.companions.flatMap((g) => g.choices.find((u) => u[0].section === companionIds[groupKey(g)]) ?? [])]
    : [];
  const complete = !!option && option.companions.every((g) => companionIds[groupKey(g)]);

  useEffect(() => {
    onPreview(chosen.length ? chosen : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryId, JSON.stringify(companionIds)]);

  const missing = missingPrereqs(course, completed);
  const units = parseFloat(course.units ?? "") || 4;
  const lectures = options.some((o) => o.companions.length) ? "Lecture" : "Section";
  const clashOf = (u: Unit) => clashesWith(u, schedule, course.code);

  const add = (sections: Section[]) =>
    onAdd({ code: course.code, title: course.title, units, reason: sections.length ? "Picked by you" : "Picked by you (times not posted yet)", sections });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{course.code} · {course.title}</p>
          <p className="text-xs text-zinc-500">{units} units{course.prereqText ? ` · Prereqs: ${course.prereqText}` : ""}</p>
        </div>
        <button onClick={onClose} className="text-lg leading-none text-zinc-400" aria-label="Close">×</button>
      </div>
      {missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">You haven&apos;t taken {missing.join("; ")} yet. Check with your advisor before registering.</p>
      )}

      {options.length === 0 ? (
        <div className="space-y-2 text-sm text-zinc-600">
          <p>No {term} sections are posted for this course yet.</p>
          {onSwitchTerm && course.sections.length > 0 && (
            <button onClick={onSwitchTerm} className="w-full rounded-xl bg-bu py-2 text-sm font-semibold text-white">See its {course.sections[0].term} sections</button>
          )}
          <button onClick={() => add([])} className="w-full rounded-xl border border-zinc-300 py-2 text-sm font-semibold">Add it anyway (times TBA)</button>
        </div>
      ) : (
        <>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{lectures} · {options.length} options</p>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {options.map((o) => (
                <UnitRow
                  key={o.primary[0].section}
                  unit={o.primary}
                  picked={primaryId === o.primary[0].section}
                  clashes={clashOf(o.primary)}
                  onPick={() => {
                    setPrimaryId(o.primary[0].section);
                    setCompanionIds({});
                  }}
                />
              ))}
            </div>
          </div>
          {option?.companions.map((g) => (
            <div key={groupKey(g)}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Pick a {g.label.toLowerCase()} · {g.choices.length} options</p>
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {g.choices.map((u) => (
                  <UnitRow
                    key={u[0].section}
                    unit={u}
                    picked={companionIds[groupKey(g)] === u[0].section}
                    clashes={clashOf(u)}
                    onPick={() => setCompanionIds({ ...companionIds, [groupKey(g)]: u[0].section })}
                  />
                ))}
              </div>
            </div>
          ))}
          <button
            disabled={!complete}
            onClick={() => add(chosen)}
            className="w-full rounded-xl bg-bu py-2.5 text-sm font-semibold text-white disabled:bg-zinc-300"
          >
            {!option
              ? `Pick a ${lectures.toLowerCase()}`
              : !complete
                ? `Pick a ${option.companions.find((g) => !companionIds[groupKey(g)])!.label.toLowerCase()}`
                : `${existing ? "Update" : "Add"} ${shortCode(course.code)} ${[...new Set(chosen.map((s) => s.section))].join(" + ")}${clashesWith(chosen, schedule, course.code).length ? " (clashes)" : ""}`}
          </button>
        </>
      )}
    </div>
  );
}
