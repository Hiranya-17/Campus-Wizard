"use client";
import { useMemo, useRef, useState } from "react";
import { BudgetView, CATEGORY_LABEL } from "@/components/BudgetView";
import { Button, Card, PageTitle, Pill } from "@/components/ui";
import { summarize } from "@/lib/budget";
import { DEFAULT_BUDGET } from "@/lib/demo";
import { money } from "@/lib/format";
import { useProfile } from "@/lib/profile";
import type { Category, Expense } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

const newId = () => `m${Date.now().toString(36)}`;
const today = () => new Date().toLocaleDateString("en-CA");

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function Budget() {
  const { profile, update } = useProfile();
  const expenses = profile.expenses ?? [];
  const summary = useMemo(() => summarize(profile.expenses ?? [], profile.budget ?? DEFAULT_BUDGET), [profile.expenses, profile.budget]);
  const [found, setFound] = useState<Expense[]>([]);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const [manual, setManual] = useState({ merchant: "", amount: "", category: "food" as Category });
  const fileRef = useRef<HTMLInputElement>(null);

  const add = (list: Expense[]) => update({ expenses: [...list, ...expenses] });

  const extract = async (body: object) => {
    setBusy(true);
    const res = await fetch("/api/expenses/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setFound(data.expenses ?? []);
    setBusy(false);
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    await extract({ imageBase64: await fileToBase64(file), mimeType: file.type || "image/jpeg" });
  };

  return (
    <div className="space-y-4">
      <BudgetView summary={summary} />

      <Card className="space-y-2">
        <p className="text-sm font-semibold">Log spending automatically</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Reading…" : "📷 Snap a receipt"}</Button>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={2} placeholder="…or paste an order confirmation email (DoorDash, Amazon, MBTA)" className="w-full rounded-lg border border-zinc-300 p-2 text-xs" />
        <Button variant="secondary" disabled={busy || !paste.trim()} onClick={() => extract({ text: paste })}>Read email</Button>
        {found.length > 0 && (
          <ul className="space-y-1">
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
        <h2 className="mb-2 font-semibold">Recent</h2>
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
      <PageTitle title="Money" subtitle="Track your semester budget and keep spending on pace." />
      <Budget />
    </div>
  );
}
