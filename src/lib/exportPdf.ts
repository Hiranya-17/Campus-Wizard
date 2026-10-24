"use client";
import { summarize } from "@/lib/budget";
import type { Budget, Expense } from "@/lib/types";

const money = (n: number) => `$${n.toFixed(2)}`;
const LABEL: Record<string, string> = { food: "Food", transport: "Transport", textbooks: "Textbooks", entertainment: "Fun", daily: "Day-to-day" };

/** Download the student's expenses as a PDF: semester summary by category, then every purchase. */
export async function exportExpensesPdf(expenses: Expense[], budget: Budget, name?: string) {
  const { jsPDF } = await import("jspdf"); // loaded only when someone exports
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48;
  let y = M;
  const line = (x1: number, x2: number) => { doc.setDrawColor(220); doc.line(x1, y, x2, y); };
  const newPageIfNeeded = (need = 18) => { if (y + need > H - M) { doc.addPage(); y = M; } };

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(204, 0, 0).text("CampusWizard · Expense report", M, y);
  y += 20;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  doc.text(`${name ? `${name} · ` : ""}Semester ${budget.semesterStart} to ${budget.semesterEnd} · exported ${new Date().toLocaleDateString("en-US")}`, M, y);
  y += 28;

  const s = summarize(expenses, budget);
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20).text("Summary", M, y);
  y += 16;
  const cols = [M, M + 160, M + 260, M + 360];
  doc.setFontSize(9).setTextColor(110);
  ["Category", "Spent", "Budget", "On pace for"].forEach((h, i) => doc.text(h, cols[i], y));
  y += 6; line(M, W - M); y += 14;
  doc.setFont("helvetica", "normal").setTextColor(20).setFontSize(10);
  for (const c of [...s.categories, { category: "total", spent: s.total.spent, limit: s.total.limit, projected: s.total.projected }]) {
    if (c.category === "total") { doc.setFont("helvetica", "bold"); }
    doc.text(c.category === "total" ? "Total" : LABEL[c.category] ?? c.category, cols[0], y);
    doc.text(money(c.spent), cols[1], y);
    doc.text(money(c.limit), cols[2], y);
    doc.text(money(c.projected), cols[3], y);
    y += 16;
  }
  y += 16;

  doc.setFont("helvetica", "bold").setFontSize(12).text(`Purchases (${expenses.length})`, M, y);
  y += 16;
  const pc = [M, M + 80, M + 330, M + 430];
  doc.setFontSize(9).setTextColor(110);
  ["Date", "Where", "Category", "Amount"].forEach((h, i) => doc.text(h, pc[i], y));
  y += 6; line(M, W - M); y += 14;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(20);
  for (const e of [...expenses].sort((a, b) => b.date.localeCompare(a.date))) {
    newPageIfNeeded();
    doc.text(e.date, pc[0], y);
    doc.text(doc.splitTextToSize(e.merchant, 240)[0] ?? "", pc[1], y);
    doc.text(LABEL[e.category] ?? e.category, pc[2], y);
    doc.text(money(e.amount), pc[3], y);
    y += 15;
  }
  doc.save(`rhett-expenses-${new Date().toISOString().slice(0, 10)}.pdf`);
}
