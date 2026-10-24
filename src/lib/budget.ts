import type { Budget, BudgetSummary, Expense } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

const DAY = 86_400_000;
/** Purchases this big (textbooks, a semester T pass) are one-offs, not a daily pace. */
const ONE_TIME = 75;

/** Spent so far per category, and where that pace lands by the end of the semester. */
export function summarize(expenses: Expense[], budget: Budget, today = new Date()): BudgetSummary {
  const start = new Date(budget.semesterStart).getTime();
  const end = new Date(budget.semesterEnd).getTime();
  const daysTotal = Math.max(1, Math.round((end - start) / DAY));
  const daysElapsed = Math.min(daysTotal, Math.max(1, Math.round((today.getTime() - start) / DAY)));
  const inTerm = expenses.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= start && t <= end;
  });
  const round = (n: number) => Math.round(n * 100) / 100;
  const categories = CATEGORIES.map((category) => {
    const items = inTerm.filter((e) => e.category === category);
    const spent = round(items.reduce((s, e) => s + e.amount, 0));
    const oneTime = items.filter((e) => e.amount >= ONE_TIME).reduce((s, e) => s + e.amount, 0);
    const projected = round(oneTime + ((spent - oneTime) / daysElapsed) * daysTotal);
    return { category, spent, limit: budget.limits[category], projected };
  });
  const sum = (k: "spent" | "limit" | "projected") => round(categories.reduce((s, c) => s + c[k], 0));
  return { daysElapsed, daysTotal, categories, total: { spent: sum("spent"), limit: sum("limit"), projected: sum("projected") } };
}
