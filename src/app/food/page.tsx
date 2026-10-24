"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, PageTitle, Pill } from "@/components/ui";
import { DiningRecommendations, DiningView, FoodView } from "@/components/views";
import { compareFood } from "@/lib/food";
import { money } from "@/lib/format";
import { useProfile } from "@/lib/profile";
import type { DiningHallToday, DiningRecommendation, FoodComparison, FoodQuote } from "@/lib/types";

const newId = () => `m${Date.now().toString(36)}`;
const today = () => new Date().toLocaleDateString("en-CA");

const CUISINE_CHIPS = ["Italian", "Asian", "Mexican", "Indian", "Mediterranean", "American", "Vegan"];
const DIET_CHIPS = ["vegan", "vegetarian", "halal", "gluten-free"];
const MEALS = ["breakfast", "lunch", "dinner"] as const;

function DiningHalls() {
  const [halls, setHalls] = useState<DiningHallToday[]>([]);
  const [loading, setLoading] = useState(true);
  const [cuisine, setCuisine] = useState("");
  const [meal, setMeal] = useState<(typeof MEALS)[number] | "">("");
  const [diet, setDiet] = useState<string[]>([]);
  const [recs, setRecs] = useState<DiningRecommendation[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/dining")
      .then((r) => r.json())
      .then((data) => setHalls(data))
      .finally(() => setLoading(false));
  }, []);

  const toggleDiet = (d: string) => setDiet((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));

  const recommend = async () => {
    setBusy(true);
    setRecs(null);
    const res = await fetch("/api/dining/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuisine, meal: meal || undefined, tags: diet.length ? diet : undefined }),
    });
    const data = await res.json();
    setRecs(data.recommendations ?? []);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <p className="text-sm font-semibold">What are you in the mood for?</p>
        <input
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          placeholder="e.g. something spicy, Italian, comfort food"
          className="w-full rounded-lg border border-zinc-300 p-2 text-sm"
          aria-label="Cuisine you want"
        />
        <div className="flex flex-wrap gap-1">
          {CUISINE_CHIPS.map((c) => (
            <button key={c} onClick={() => setCuisine(c)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cuisine === c ? "bg-bu text-white" : "bg-zinc-100 text-zinc-700"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-zinc-500">Meal:</span>
          {MEALS.map((m) => (
            <button key={m} onClick={() => setMeal(meal === m ? "" : m)} className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${meal === m ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-zinc-500">Diet:</span>
          {DIET_CHIPS.map((d) => (
            <button key={d} onClick={() => toggleDiet(d)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${diet.includes(d) ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-700"}`}>
              {d}
            </button>
          ))}
        </div>
        <Button onClick={recommend} disabled={busy}>{busy ? "Thinking…" : "Recommend where to eat"}</Button>
        {recs != null && (recs.length > 0 ? <DiningRecommendations recs={recs} /> : <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Nothing on today&apos;s menus matched that. Try another cuisine or drop a filter.</p>)}
      </Card>

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold">Dining halls <Pill>{halls.filter((h) => h.openNow).length} open now</Pill></h2>
        <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Sample menus, not today&apos;s real menu: BU doesn&apos;t publish menus in a form we can read yet. Hours are typical hours; check each hall&apos;s BU Dining page for today&apos;s menu and holiday hours.
        </p>
        {loading ? <p className="text-sm text-zinc-500">Loading today&apos;s menus…</p> : <DiningView halls={halls} />}
      </section>

    </div>
  );
}

function Delivery() {
  const { profile, update } = useProfile();
  const [quotes, setQuotes] = useState<FoodQuote[]>([]);
  const [q, setQ] = useState("");
  const [logged, setLogged] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/food").then((r) => r.json()).then(setQuotes);
  }, []);
  const data = useMemo(() => compareFood(quotes, q).sort((a, b) => b.savings - a.savings), [quotes, q]);
  const avg = data.length ? data.reduce((s, r) => s + r.savings, 0) / data.length : 0;
  const sample = quotes.some((x) => x.restaurant.startsWith("SAMPLE"));
  const order = (r: FoodComparison) => {
    const best = r.quotes[0];
    update({ expenses: [{ id: newId(), date: today(), amount: best.total, merchant: `${best.app}: ${r.restaurant}`, category: "food", paidWith: best.acceptsConveniencePoints ? "convenience points" : "card", source: "food-compare" }, ...(profile.expenses ?? [])] });
    setLogged(r.restaurant);
  };
  return (
    <div className="space-y-4">
      {data.length > 0 && (
        <Card className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">Average saved by picking the cheapest app</span>
          <span className="text-xl font-bold text-green-700">{money(avg)}</span>
        </Card>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a restaurant" className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm" aria-label="Search a restaurant" />
      {sample && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Sample prices. Real prices collected near campus are coming.</p>}
      {logged && <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">Logged your {logged} order in your budget.</p>}
      <FoodView data={data} onOrder={order} />
    </div>
  );
}

function Food() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"dining" | "delivery">(params.get("tab") === "delivery" ? "delivery" : "dining");
  return (
    <div className="space-y-4">
      <PageTitle title="A break worth taking." subtitle="Dining halls open now, and the cheapest way to get delivery." />
      <div className="flex gap-1 rounded-xl bg-zinc-200 p-1 text-sm font-semibold">
        {(["dining", "delivery"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-1.5 ${tab === t ? "bg-white shadow-sm" : "text-zinc-600"}`}>
            {t === "dining" ? "Dining halls" : "Cheapest delivery"}
          </button>
        ))}
      </div>
      {tab === "dining" ? <DiningHalls /> : <Delivery />}
    </div>
  );
}

export default function FoodPage() {
  return (
    <Suspense>
      <Food />
    </Suspense>
  );
}
