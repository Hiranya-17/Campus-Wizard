"use client";
import { useEffect, useRef, useState } from "react";
import { BudgetView, CATEGORY_LABEL } from "@/components/BudgetView";
import { CourseView, FoodView, SemesterView, WeekView } from "@/components/views";
import { money } from "@/lib/format";
import type { ChatCard, ChatMessage, ChatResponse, Profile } from "@/lib/types";

type Turn = ChatMessage & { cards?: ChatCard[] };

/**
 * Conversation with Rhett. The parent owns the profile so schedule changes Rhett makes
 * (and expenses it logs) show up on the parent's screen right away.
 */
export function ChatPanel({
  profile,
  update,
  suggestions,
  intro,
  initial,
  compact = false,
}: {
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  suggestions: string[];
  intro?: React.ReactNode;
  initial?: string | null;
  compact?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const apply = (cards: ChatCard[] = []) => {
    for (const c of cards) {
      if (c.kind === "schedule") update({ semester: c.data });
    }
    const logged = cards.flatMap((c) => (c.kind === "expense" ? [c.data] : []));
    if (logged.length) update({ expenses: [...logged, ...(profile.expenses ?? [])] });
  };

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
      apply(data.cards);
    } catch {
      setTurns([...next, { role: "assistant", content: "I couldn't reach the server. Try again?" }]);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (initial && !asked.current) {
      asked.current = true;
      send(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, busy]);

  const card = (c: ChatCard, i: number) => {
    switch (c.kind) {
      case "semester":
        return <SemesterView key={i} plan={c.data} onUse={() => update({ semester: c.data, term: c.data.term })} />;
      case "schedule":
        return (
          <p key={i} className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
            ✓ Schedule updated: {c.data.courses.map((x) => x.code.split(" ").slice(1).join(" ")).join(", ") || "empty"} ({c.data.totalUnits} units)
          </p>
        );
      case "week":
        return <WeekView key={i} plan={c.data} />;
      case "food":
        return <FoodView key={i} data={c.data} />;
      case "budget":
        return <BudgetView key={i} summary={c.data} />;
      case "expense":
        return (
          <p key={i} className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
            ✓ Logged {money(c.data.amount)} at {c.data.merchant} ({CATEGORY_LABEL[c.data.category]})
          </p>
        );
      case "course":
        return <CourseView key={i} course={c.data} />;
    }
  };

  return (
    <div className={`flex flex-col ${compact ? "h-full" : "min-h-[calc(100dvh-10rem)]"}`}>
      <div className={`flex-1 space-y-3 ${compact ? "overflow-y-auto px-1" : ""}`}>
        {turns.length === 0 && (
          <div>
            {intro}
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm">{s}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            <div className={t.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-bu px-3 py-2 text-sm text-white" : "w-full"}>
              {t.role === "user" ? t.content : <p className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm shadow-sm">{t.content.replace(/\*\*/g, "")}</p>}
              {t.cards && t.cards.length > 0 && <div className="mt-2 space-y-2">{t.cards.map(card)}</div>}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-zinc-400">Rhett is thinking…</p>}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className={`${compact ? "" : "sticky bottom-20"} mt-3 flex gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-md`}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Rhett anything…" className="min-w-0 flex-1 px-2 text-sm outline-none" />
        <button disabled={busy || !input.trim()} className="rounded-xl bg-bu px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-300">Send</button>
      </form>
    </div>
  );
}
