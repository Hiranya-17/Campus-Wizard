"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BudgetView, CATEGORY_LABEL } from "@/components/BudgetView";
import { CourseView, FoodView, SemesterView, WeekView } from "@/components/views";
import { money } from "@/lib/format";
import { useProfile } from "@/lib/profile";
import type { ChatCard, ChatMessage, ChatResponse } from "@/lib/types";

type Turn = ChatMessage & { cards?: ChatCard[] };

const SUGGESTIONS = ["When should I leave for class?", "Plan my spring semester", "Plan my week", "How's my budget?", "Can I take EC 413?", "Cheapest pizza?"];

function Cards({ cards }: { cards: ChatCard[] }) {
  return (
    <div className="mt-2 space-y-2">
      {cards.map((c, i) =>
        c.kind === "semester" ? <SemesterView key={i} plan={c.data} />
        : c.kind === "week" ? <WeekView key={i} plan={c.data} />
        : c.kind === "food" ? <FoodView key={i} data={c.data} />
        : c.kind === "budget" ? <BudgetView key={i} summary={c.data} />
        : c.kind === "expense" ? (
          <p key={i} className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
            ✓ Logged {money(c.data.amount)} at {c.data.merchant} ({CATEGORY_LABEL[c.data.category]})
          </p>
        )
        : <CourseView key={i} course={c.data} />,
      )}
    </div>
  );
}

function Chat() {
  const { profile, update } = useProfile();
  const params = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), profile }),
      });
      const data: ChatResponse = await res.json();
      setTurns([...next, { role: "assistant", content: data.reply, cards: data.cards }]);
      const sem = data.cards?.find((c) => c.kind === "semester");
      if (sem && sem.kind === "semester" && !profile.semester) update({ semester: sem.data });
      const logged = (data.cards ?? []).flatMap((c) => (c.kind === "expense" ? [c.data] : []));
      if (logged.length) update({ expenses: [...logged, ...(profile.expenses ?? [])] });
    } catch {
      setTurns([...next, { role: "assistant", content: "I couldn't reach the server. Try again?" }]);
    }
    setBusy(false);
  };

  useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current) {
      asked.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [turns, busy]);

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      {turns.length === 0 && (
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Ask Rhett</h1>
          <p className="mt-1 text-sm text-zinc-500">Your BU assistant for registration, your week and food.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm">{s}</button>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 space-y-3">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            <div className={t.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-bu px-3 py-2 text-sm text-white" : "w-full"}>
              {t.role === "user" ? t.content : <p className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm shadow-sm">{t.content.replace(/\*\*/g, "")}</p>}
              {t.cards && t.cards.length > 0 && <Cards cards={t.cards} />}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-zinc-400">Rhett is thinking…</p>}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="sticky bottom-20 mt-3 flex gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-md"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Rhett anything…" className="min-w-0 flex-1 px-2 text-sm outline-none" />
        <button disabled={busy || !input.trim()} className="rounded-xl bg-bu px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-300">Send</button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
