"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, PageTitle } from "@/components/ui";
import { FoodView } from "@/components/views";
import { compareFood } from "@/lib/food";
import { money } from "@/lib/format";
import type { FoodQuote } from "@/lib/types";

export default function FoodPage() {
  const [quotes, setQuotes] = useState<FoodQuote[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    fetch("/api/food").then((r) => r.json()).then(setQuotes);
  }, []);
  const data = useMemo(() => compareFood(quotes, q).sort((a, b) => b.savings - a.savings), [quotes, q]);
  const avg = data.length ? data.reduce((s, r) => s + r.savings, 0) / data.length : 0;
  const sample = quotes.some((x) => x.restaurant.startsWith("SAMPLE"));

  return (
    <div className="space-y-4">
      <PageTitle title="Cheapest delivery" subtitle="Same order, same address: total cost on DoorDash, Uber Eats and Grubhub including every fee and tax." />
      {data.length > 0 && (
        <Card className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">Average saved by picking the cheapest app</span>
          <span className="text-xl font-bold text-green-700">{money(avg)}</span>
        </Card>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a restaurant" className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm" />
      {sample && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Sample prices. Real prices collected near campus are coming.</p>}
      <FoodView data={data} />
    </div>
  );
}
