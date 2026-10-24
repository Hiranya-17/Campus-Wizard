import { NextResponse } from "next/server";
import { extractExpensesGemini, extractExpensesRules } from "@/lib/agent/receipts";
import type { ExpenseExtractRequest } from "@/lib/types";

// POST /api/expenses/extract  ExpenseExtractRequest -> { expenses: Expense[], engine }
// Receipt photos and order-confirmation emails become expenses.
export async function POST(req: Request) {
  const body = (await req.json()) as ExpenseExtractRequest;
  if (process.env.GEMINI_API_KEY) {
    try {
      return NextResponse.json({ expenses: await extractExpensesGemini(body), engine: "gemini" });
    } catch (e) {
      console.error(e);
    }
  }
  return NextResponse.json({ expenses: extractExpensesRules(body), engine: "rules" });
}
