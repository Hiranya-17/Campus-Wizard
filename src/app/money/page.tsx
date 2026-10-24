"use client";
import { useMemo, useRef, useState } from "react";
import { BudgetView, CATEGORY_LABEL } from "@/components/BudgetView";
import { GmailImport } from "@/components/GmailImport";
import { Button, Card, PageTitle, Pill } from "@/components/ui";
import { summarize } from "@/lib/budget";
import { DEFAULT_BUDGET } from "@/lib/demo";
import { exportExpensesPdf } from "@/lib/exportPdf";
import { expensesFromRows, parseCsv } from "@/lib/statements";
import { money } from "@/lib/format";
import { useProfile } from "@/lib/profile";
import type { Category, Expense } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

const newId = () => `m${Date.now().toString(36)}`;
const today = () => new Date().toLocaleDateString("en-CA");

/**
 * Read a photo as base64 JPEG, scaled to at most 1600px. Phone photos are often 4-7 MB once encoded,
 * over Vercel's 4.5 MB request limit; scaled down they're a few hundred KB and still easy to read.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Same purchase already logged (same day, amount and merchant)? Avoids double-counting re-uploads. */
const sameExpense = (a: Expense, b: Expense) => a.date === b.date && Math.abs(a.amount - b.amount) < 0.01 && a.merchant.toLowerCase() === b.merchant.toLowerCase();

async function photoToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Budget() {
  const { profile, update } = useProfile();
  const expenses = profile.expenses ?? [];
  const summary = useMemo(() => summarize(profile.expenses ?? [], profile.budget ?? DEFAULT_BUDGET), [profile.expenses, profile.budget]);
  const [found, setFound] = useState<Expense[]>([]);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const [manual, setManual] = useState({ merchant: "", amount: "", category: "food" as Category });
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const add = (list: Expense[]) => {
    const fresh = list.filter((e) => !expenses.some((x) => sameExpense(x, e)));
    update({ expenses: [...fresh, ...expenses] });
    return fresh.length;
  };

  /** Ask the server (Gemini) to read a photo, PDF or email; returns what it found. */
  const readWithAi = async (body: object): Promise<Expense[]> => {
    const res = await fetch("/api/expenses/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 429) throw new Error("Too many uploads at once. Wait a few minutes and try again.");
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return (await res.json()).expenses ?? [];
  };

  const extract = async (body: object) => {
    setBusy(true);
    setStatus(null);
    try {
      setFound(await readWithAi(body));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Couldn't read that.");
    }
    setBusy(false);
  };

  /**
   * Photos, PDFs, CSV and Excel files. Spreadsheets are parsed right here in the browser (exact columns,
   * and the bank file never leaves the device); photos and PDFs go to Gemini.
   */
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setStatus(null);
    const all: Expense[] = [];
    const notes: string[] = [];
    for (const file of Array.from(files).slice(0, 10)) {
      const name = file.name.toLowerCase();
      try {
        if (file.type.startsWith("image/")) {
          const { data, mimeType } = await photoToBase64(file);
          all.push(...(await readWithAi({ imageBase64: data, mimeType })));
        } else if (file.type === "application/pdf" || name.endsWith(".pdf")) {
          if (file.size > 3_000_000) { notes.push(`${file.name} is over 3 MB`); continue; }
          all.push(...(await readWithAi({ pdfBase64: await fileToBase64(file) })));
        } else if (name.endsWith(".csv") || file.type === "text/csv") {
          const r = expensesFromRows(parseCsv(await file.text()));
          all.push(...r.expenses);
          if (r.note) notes.push(`${file.name}: ${r.note}`);
          else if (r.skipped) notes.push(`${file.name}: skipped ${r.skipped} payments, refunds or deposits`);
        } else if (name.endsWith(".xlsx")) {
          const { readSheet } = await import("read-excel-file/browser"); // loaded only when needed
          const r = expensesFromRows((await readSheet(file)) as unknown as Parameters<typeof expensesFromRows>[0]);
          all.push(...r.expenses);
          if (r.note) notes.push(`${file.name}: ${r.note}`);
          else if (r.skipped) notes.push(`${file.name}: skipped ${r.skipped} payments, refunds or deposits`);
        } else if (name.endsWith(".xls")) {
          notes.push(`${file.name}: old .xls files aren't supported. Save it as .xlsx or CSV.`);
        } else {
          notes.push(`${file.name}: use a photo, PDF, CSV or .xlsx file`);
        }
      } catch (e) {
        notes.push(`${file.name}: ${e instanceof Error ? e.message : "couldn't read it"}`);
      }
    }
    const fresh = all.filter((e) => !expenses.some((x) => sameExpense(x, e)));
    setFound(fresh);
    const dupes = all.length - fresh.length;
    setStatus([
      `Found ${all.length} purchase${all.length === 1 ? "" : "s"}${dupes ? ` (${dupes} already logged)` : ""}.`,
      ...notes,
    ].join(" "));
    setBusy(false);
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const { data, mimeType } = await photoToBase64(file);
      await extract({ imageBase64: data, mimeType });
    } catch {
      setBusy(false);
      alert("Couldn't read that photo. Try another one, or paste the receipt email instead.");
    }
  };

  return (
    <div className="space-y-4">
      <BudgetView summary={summary} />

      <Card className="space-y-2">
        <p className="text-sm font-semibold">Log spending automatically</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        <input
          ref={uploadRef}
          type="file"
          multiple
          accept="image/*,.pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Reading…" : "Snap a receipt"}</Button>
          <Button variant="secondary" onClick={() => uploadRef.current?.click()} disabled={busy}>Upload files</Button>
        </div>
        <p className="text-[11px] text-zinc-500">Upload receipt photos, PDF receipts or statements, or a bank / card export (CSV or Excel).</p>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={2} placeholder="…or paste an order confirmation email (DoorDash, Amazon, MBTA)" className="w-full rounded-lg border border-zinc-300 p-2 text-xs" />
        <Button variant="secondary" disabled={busy || !paste.trim()} onClick={() => extract({ text: paste })}>Read email</Button>
        <p className="text-[11px] text-zinc-400">Photos, PDFs and emails are sent to Google Gemini to read them; CSV and Excel files are read on your device. We keep only the purchases you add.</p>
        {status && <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">{status}</p>}
        {found.length > 1 && (
          <Button onClick={() => { const n = add(found); setFound([]); setStatus(`Added ${n} purchase${n === 1 ? "" : "s"}.`); }}>
            Add all {found.length} ({money(found.reduce((s, e) => s + e.amount, 0))})
          </Button>
        )}
        {found.length > 0 && (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {found.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-lg bg-green-50 px-2 py-1.5 text-xs">
                <span className="flex-1"><span className="font-semibold">{e.merchant}</span> · {CATEGORY_LABEL[e.category]} · {e.date}</span>
                <span className="font-semibold tabular-nums">{money(e.amount)}</span>
                <button className="font-semibold text-bu" onClick={() => { add([e]); setFound(found.filter((f) => f !== e)); setPaste(""); }}>Add</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <GmailImport mode="expenses" onSaveExpenses={(exps) => add(exps)} />

      <Card className="space-y-2">
        <p className="text-sm font-semibold">Add by hand</p>
        <div className="flex gap-1">
          <input value={manual.merchant} onChange={(e) => setManual({ ...manual, merchant: e.target.value })} placeholder="Where" className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-2 text-sm" />
          <input value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} placeholder="$" inputMode="decimal" className="w-16 rounded-lg border border-zinc-300 p-2 text-sm" />
          <select value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value as Category })} className="rounded-lg border border-zinc-300 p-2 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <button
            disabled={!manual.merchant || !Number(manual.amount)}
            onClick={() => {
              add([{ id: newId(), date: today(), amount: Number(manual.amount), merchant: manual.merchant, category: manual.category, paidWith: "card", source: "manual" }]);
              setManual({ merchant: "", amount: "", category: manual.category });
            }}
            className="rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white disabled:bg-zinc-300"
          >
            +
          </button>
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Recent</h2>
          {expenses.length > 0 && (
            <button
              onClick={() => exportExpensesPdf(expenses, profile.budget ?? DEFAULT_BUDGET, profile.name)}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700"
            >
              ⬇ Export PDF
            </button>
          )}
        </div>
        <ul className="space-y-1">
          {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
              <span className="w-12 shrink-0 text-xs text-zinc-400">{e.date.slice(5)}</span>
              <span className="min-w-0 flex-1 truncate">{e.merchant}</span>
              {e.paidWith !== "card" && <Pill tone="red">{e.paidWith}</Pill>}
              <span className="tabular-nums">{money(e.amount)}</span>
              <button className="text-zinc-300" onClick={() => update({ expenses: expenses.filter((x) => x.id !== e.id) })}>✕</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function MoneyPage() {
  return (
    <div className="space-y-4">
      <PageTitle title="Spend with a little intention." subtitle="Your semester budget, receipts and spending pace, in one place." />
      <Budget />
    </div>
  );
}
