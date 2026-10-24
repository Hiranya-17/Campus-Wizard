"use client";
import Link from "next/link";
import { IconBook } from "@/components/icons";
import { Card, EmptyState } from "@/components/ui";
import { fmtTime } from "@/lib/format";
import { shortCourse, studyPriorities } from "@/lib/study";
import type { Assignment } from "@/lib/types";

const MONTH = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short" }).toUpperCase();
const DAYNUM = (iso: string) => Number(iso.slice(8, 10));
const WEEKDAY = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });

/** "Coming up": exams and homework from syllabi, most urgent first (grade weight ÷ days left), with what to do. */
export function StudyCard({ assignments }: { assignments: Assignment[] }) {
  const top = studyPriorities(assignments).slice(0, 4);
  if (!assignments.length) {
    return (
      <Card>
        <EmptyState
          icon={<IconBook size={20} />}
          title="Nothing on the calendar yet."
          body="Add a syllabus on the Semester tab and CampusWizard will tell you what to study before each exam."
          action={<Link href="/plan" className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 px-3 text-sm font-semibold">Add a syllabus</Link>}
        />
      </Card>
    );
  }
  if (!top.length) return <Card className="text-sm text-zinc-500">Nothing due in the next three weeks. Enjoy the calm.</Card>;
  return (
    <Card className="!p-5">
      <ul className="divide-y divide-zinc-100">
        {top.map((p, i) => {
          const a = p.assignment;
          const when = a.kind === "exam" || a.kind === "quiz"
            ? `${WEEKDAY(a.date)}${a.time != null ? ` · ${fmtTime(a.time)}` : ""}`
            : `${WEEKDAY(a.date)} · Due ${a.time != null ? `at ${fmtTime(a.time)}` : "end of day"}`;
          return (
            <li key={a.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
              <span className={`w-11 shrink-0 text-center ${i === 0 ? "text-bu" : "text-zinc-800"}`}>
                <span className="block text-[10px] font-semibold tracking-wider text-zinc-400">{MONTH(a.date)}</span>
                <span className="block text-2xl font-bold leading-none">{DAYNUM(a.date)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{shortCourse(a.courseCode)} {a.title}</span>
                  <span className={`shrink-0 text-[11px] font-semibold ${p.daysLeft <= 1 ? "text-bu" : p.daysLeft <= 4 ? "text-amber-700" : "text-zinc-400"}`}>
                    {p.daysLeft === 0 ? "Today" : p.daysLeft === 1 ? "Tomorrow" : `${p.daysLeft} days`}
                  </span>
                </span>
                <span className="block text-sm text-zinc-500">{when}{a.weight != null ? ` · ${a.weight}%` : ""}</span>
                {i === 0 && <span className="mt-1 block text-sm text-zinc-700">{p.advice}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-400">Ranked by grade weight and days left. Your week plan adds study time for the top one.</p>
    </Card>
  );
}
