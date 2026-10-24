"use client";
import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import { shortCourse, studyPriorities } from "@/lib/study";
import type { Assignment } from "@/lib/types";

/** Home card: the most urgent exams and homework, ranked by weight and days left, with what to do about each. */
export function StudyCard({ assignments }: { assignments: Assignment[] }) {
  const top = studyPriorities(assignments).slice(0, 3);
  if (!assignments.length) {
    return (
      <Card className="text-sm text-zinc-600">
        Add your syllabi on the <Link href="/plan" className="font-semibold text-bu">Plan</Link> tab and Rhett will tell you what to study before each exam.
      </Card>
    );
  }
  if (!top.length) return <Card className="text-sm text-zinc-500">Nothing due in the next three weeks.</Card>;
  const next = top[0];
  return (
    <Card className="space-y-2 !p-3">
      <p className="text-xs text-zinc-500">Prioritize today</p>
      <ol className="space-y-2">
        {top.map((p, i) => (
          <li key={p.assignment.id} className={`rounded-lg px-3 py-2 ${i === 0 ? "bg-red-50" : "bg-zinc-50"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                {i + 1}. {shortCourse(p.assignment.courseCode)} {p.assignment.title}
              </p>
              <Pill tone={p.daysLeft <= 1 ? "red" : p.daysLeft <= 4 ? "amber" : "zinc"}>
                {p.daysLeft === 0 ? "today" : p.daysLeft === 1 ? "tomorrow" : `${p.daysLeft} days`}
              </Pill>
            </div>
            <p className="mt-0.5 text-xs text-zinc-600">
              {p.advice}
              {p.assignment.weight != null && ` Worth ${p.assignment.weight}% of your grade.`}
            </p>
          </li>
        ))}
      </ol>
      {next.assignment.kind === "exam" && next.daysLeft <= 7 && (
        <p className="text-[11px] text-zinc-500">Your week plan gives {shortCourse(next.assignment.courseCode)} extra study blocks until the exam.</p>
      )}
    </Card>
  );
}
