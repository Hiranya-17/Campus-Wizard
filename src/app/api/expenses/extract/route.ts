import { NextResponse } from "next/server";
import { extractExpensesGemini, extractExpensesRules } from "@/lib/agent/receipts";
import { rateLimit, readJson } from "@/lib/guard";
import type { ExpenseExtractRequest } from "@/lib/types";

// POST /api/expenses/extract  ExpenseExtractRequest -> { expenses: Expense[], engine }
// Receipt photos and order-confirmation emails become expenses.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "receipts", 20, 600);
  if (limited) return limited;
  const parsed = await readJson<ExpenseExtractRequest>(req, 4_000_000);
  if ("error" in parsed) return parsed.error;
  const body = { ...parsed.body, text: parsed.body.text?.slice(0, 30_000) };
  if (process.env.GEMINI_API_KEY) {
    try {
      return NextResponse.json({ expenses: await extractExpensesGemini(body), engine: "gemini" });
    } catch (e) {
      console.error(e);
    }
  }
  return NextResponse.json({ expenses: extractExpensesRules(body), engine: "rules" });
}
