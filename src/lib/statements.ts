import type { Category, Expense } from "@/lib/types";

/**
 * Bank and card exports (CSV / Excel) turned into expenses, entirely in the browser: the file never leaves
 * the device. Spreadsheets have exact columns, so plain parsing beats AI here.
 */

const KEYWORDS: [Category, RegExp][] = [
  ["food", /doordash|uber ?eats|grubhub|pizza|chipotle|starbucks|dunkin|coffee|cafe|caf[eé]|restaurant|grocery|groceries|trader joe|star market|whole ?foods|sushi|burger|mcdonald|sweetgreen|dining|bakery|deli|taco|market basket/i],
  ["transport", /mbta|charlie ?card|\buber\b(?! ?eats)|lyft|bluebikes|amtrak|zipcar|parking|shell|exxon|gas station/i],
  ["textbooks", /textbook|barnes|bookstore|pearson|mcgraw|cengage|chegg|wiley|course ?materials/i],
  ["entertainment", /amc|cinema|movie|ticket|spotify|netflix|hulu|disney|concert|steam|playstation|xbox|fenway|red sox|apple\.com\/bill|youtube/i],
  ["daily", /cvs|walgreens|target|amazon|laundry|pharmacy|cvs|7-eleven|staples|bed bath|walmart|ikea/i],
];

/** Best-guess budget category from a merchant or description. */
export function categoryOf(text: string): Category {
  return KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "daily";
}

/** Minimal CSV reader: quoted fields, escaped quotes, commas/newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

type Cell = string | number | boolean | Date | null | undefined;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "10/24/2026", "2026-10-24", "10/24/26", "Oct 24, 2026" or an Excel date -> "2026-10-24". */
export function toIsoDate(v: Cell): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // spreadsheet dates arrive as midnight UTC, which is the previous evening in Boston: read the UTC calendar day
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number" && v > 30000 && v < 80000) return iso(new Date(Math.round((v - 25569) * 86_400_000) + 12 * 3_600_000)); // Excel serial
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const parsed = Date.parse(s);
  return s && !isNaN(parsed) && /[a-z]/i.test(s) ? iso(new Date(parsed)) : null;
}

/** "$1,234.56", "-12.00", "(12.00)" -> number; NaN if not money. */
export function toAmount(v: Cell): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return s.replace(/[^0-9.]/g, "") === "" ? NaN : neg ? -n : n;
}

const find = (header: string[], re: RegExp) => header.findIndex((h) => re.test(h));

export interface StatementResult {
  expenses: Expense[];
  skipped: number; // payments, refunds, deposits and unreadable rows
  note?: string;
}

/**
 * Rows of a bank/card export -> purchases. Finds the header row by its column names (Date, Description/Merchant,
 * Amount or Debit/Credit). Purchases are the debits: negative amounts when the file mixes signs, otherwise every row.
 */
export function expensesFromRows(rows: Cell[][]): StatementResult {
  const headerAt = rows.findIndex((r) => {
    const h = r.map((c) => String(c ?? "").toLowerCase());
    return find(h, /date/) >= 0 && (find(h, /amount|debit|withdraw|charge|spent/) >= 0);
  });
  if (headerAt < 0) return { expenses: [], skipped: rows.length, note: "Couldn't find Date and Amount columns. Is this a bank or card export?" };
  const header = rows[headerAt].map((c) => String(c ?? "").toLowerCase().trim());
  const col = {
    date: find(header, /^(transaction |trans\.? |posted |post )?date/) >= 0 ? find(header, /^(transaction |trans\.? |posted |post )?date/) : find(header, /date/),
    desc: find(header, /description|merchant|payee|name|details|memo|narrative/),
    amount: find(header, /^amount|amount$|^amt/),
    debit: find(header, /debit|withdraw|charge|spent/),
    credit: find(header, /credit|deposit/),
    category: find(header, /category|type/),
  };
  const body = rows.slice(headerAt + 1);
  const amounts = body.map((r) => toAmount(r[col.amount]));
  const signed = col.amount >= 0 && amounts.some((a) => a < 0) && amounts.some((a) => a > 0);

  const expenses: Expense[] = [];
  let skipped = 0;
  body.forEach((r, i) => {
    const date = toIsoDate(r[col.date]);
    const desc = String(r[col.desc] ?? "").replace(/\s+/g, " ").trim() || "Purchase";
    let amount: number;
    if (col.debit >= 0 && col.debit !== col.amount) {
      amount = Math.abs(toAmount(r[col.debit]));
    } else {
      const a = amounts[i];
      amount = signed ? (a < 0 ? -a : NaN) : Math.abs(a); // mixed signs: negatives are spending
    }
    if (!date || !Number.isFinite(amount) || amount <= 0 || /payment|thank you|refund|deposit|transfer|interest|autopay/i.test(desc)) {
      skipped++;
      return;
    }
    const bankCategory = col.category >= 0 ? String(r[col.category] ?? "") : "";
    expenses.push({
      id: `st${Date.now().toString(36)}${i}`,
      date,
      amount: Math.round(amount * 100) / 100,
      merchant: desc.slice(0, 50),
      category: categoryOf(`${desc} ${bankCategory}`),
      paidWith: "card",
      source: "receipt",
    });
  });
  return { expenses, skipped };
}
