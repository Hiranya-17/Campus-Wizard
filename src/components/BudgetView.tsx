"use client";
import { Card } from "@/components/ui";
import { money } from "@/lib/format";
import type { BudgetSummary, Category } from "@/lib/types";

export const CATEGORY_LABEL: Record<Category, string> = {
  food: "Food",
  transport: "Transport",
  textbooks: "Textbooks",
  entertainment: "Fun",
  daily: "Day-to-day",
};

/** One bar per category: spent so far, plus a marker where this pace ends the semester. */
export function BudgetView({ summary }: { summary: BudgetSummary }) {
  const { total } = summary;
  const over = total.projected > total.limit;
  return (
    <Card className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-zinc-500">Spent this semester</p>
          <p className="text-2xl font-bold">{money(total.spent)} <span className="text-sm font-normal text-zinc-400">of {money(total.limit)}</span></p>
        </div>
        <p className="text-right text-xs text-zinc-500">Day {summary.daysElapsed} of {summary.daysTotal}</p>
      </div>
      <p className={`rounded-lg px-3 py-2 text-xs ${over ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
        At this pace you&apos;ll spend {money(total.projected)} by finals: {over ? `${money(total.projected - total.limit)} over budget` : `${money(total.limit - total.projected)} under budget`}.
      </p>
      <ul className="space-y-2.5">
        {summary.categories.map((c) => {
          const pct = Math.min(100, (c.spent / Math.max(1, c.limit)) * 100);
          const projPct = Math.min(100, (c.projected / Math.max(1, c.limit)) * 100);
          const warn = c.projected > c.limit;
          return (
            <li key={c.category}>
              <div className="flex justify-between text-xs">
                <span className="font-medium">{CATEGORY_LABEL[c.category]}</span>
                <span className="tabular-nums text-zinc-500">{money(c.spent)} / {money(c.limit)}</span>
              </div>
              <div className="relative mt-1 h-2 rounded-full bg-zinc-100">
                <div className={`h-2 rounded-full ${warn ? "bg-bu" : "bg-zinc-800"}`} style={{ width: `${pct}%` }} />
                <div className="absolute -top-0.5 h-3 w-0.5 bg-zinc-400" style={{ left: `${projPct}%` }} title={`Projected ${money(c.projected)}`} />
              </div>
              {warn && <p className="mt-0.5 text-[11px] text-bu">On pace for {money(c.projected)}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
