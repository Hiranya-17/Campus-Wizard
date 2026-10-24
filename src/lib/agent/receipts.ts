import "server-only";
import { geminiGenerate } from "@/lib/agent/geminiFetch";
import type { Category, Expense, ExpenseExtractRequest } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";


const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      date: { type: "string", description: "YYYY-MM-DD" },
      amount: { type: "number", description: "Final total paid in dollars, including tax, fees and tip" },
      merchant: { type: "string" },
      category: { type: "string", enum: [...CATEGORIES] },
      paidWith: { type: "string", enum: ["card", "dining points", "convenience points", "cash"] },
      note: { type: "string", description: "Items bought, short" },
    },
    required: ["amount", "merchant", "category"],
  },
};

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const id = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function extractExpensesGemini(req: ExpenseExtractRequest): Promise<Expense[]> {
  const parts: unknown[] = [{
    text: `Extract each purchase from this receipt or order confirmation for a Boston University student's budget.
Categories: food (groceries, restaurants, delivery, coffee), transport (MBTA, Uber/Lyft rides, Bluebikes), textbooks (books, course materials, software for class), entertainment (movies, concerts, games, subscriptions), daily (toiletries, pharmacy, laundry, household).
Use the final total actually charged. Today is ${today()}; if no date is shown, use today.`,
  }];
  if (req.text) parts.push({ text: req.text.slice(0, 30000) });
  if (req.imageBase64) parts.push({ inlineData: { mimeType: req.mimeType ?? "image/jpeg", data: req.imageBase64 } });
  const data = await geminiGenerate({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
  });
  const raw: Partial<Expense>[] = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? "[]");
  const source = req.imageBase64 ? "receipt" : "email";
  return raw.map((e) => ({
    id: id(),
    date: e.date ?? today(),
    amount: Math.round((e.amount ?? 0) * 100) / 100,
    merchant: e.merchant ?? "Unknown",
    category: (CATEGORIES as readonly string[]).includes(e.category ?? "") ? (e.category as Category) : "daily",
    paidWith: e.paidWith ?? "card",
    source,
    note: e.note,
  }));
}

const KEYWORDS: [Category, RegExp][] = [
  ["food", /doordash|uber ?eats|grubhub|pizza|chipotle|starbucks|dunkin|coffee|restaurant|grocery|trader joe|star market|wholefoods|whole foods|caf[eé]|sushi|burger/i],
  ["transport", /mbta|charliecard|uber(?! ?eats)|lyft|bluebikes|amtrak/i],
  ["textbooks", /textbook|barnes|bookstore|pearson|mcgraw|cengage|chegg/i],
  ["entertainment", /amc|movie|ticket|spotify|netflix|concert|steam|fenway/i],
];

/** No-key fallback: find the merchant on the first line and the largest "total". */
export function extractExpensesRules(req: ExpenseExtractRequest): Expense[] {
  const text = req.text ?? "";
  if (!text.trim()) return [];
  const totals = [...text.matchAll(/(?:order\s+)?total[^$\d]{0,20}\$?\s*(\d+(?:\.\d{2})?)/gi)].map((m) => Number(m[1]));
  const amounts = totals.length ? totals : [...text.matchAll(/\$\s*(\d+\.\d{2})/g)].map((m) => Number(m[1]));
  if (!amounts.length) return [];
  const category = KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "daily";
  const app = text.match(/\b(DoorDash|Uber Eats|Grubhub|Amazon|Instacart)\b/i)?.[1];
  const from = text.match(/(?:order|purchase) (?:from|at) ([A-Z][\w'&. -]{1,30}?)(?:\s+(?:is|has|was)\b|[.!\n])/)?.[1];
  const merchant = (app && from ? `${app}: ${from}` : from ?? app ?? text.split("\n").map((l) => l.trim()).find((l) => l.length > 2)?.slice(0, 40)) ?? "Purchase";
  return [{ id: id(), date: today(), amount: Math.max(...amounts), merchant, category, paidWith: "card", source: "email" }];
}
