"use client";
import { useEffect, useRef, useState } from "react";
import { BudgetView, CATEGORY_LABEL } from "@/components/BudgetView";
import { CourseView, FoodView, SemesterView, WeekView } from "@/components/views";
import { ApiError, postChat } from "@/lib/api";
import { IconSend, IconSparkle } from "@/components/icons";
import { money } from "@/lib/format";
import type { ChatCard, ChatMessage, Profile } from "@/lib/types";

type Turn = ChatMessage & { cards?: ChatCard[] };

/**
 * Conversation with CampusWizard. The parent owns the profile so schedule changes CampusWizard makes
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
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const apply = (cards: ChatCard[] = []) => {
    for (const c of cards) {
      if (c.kind === "schedule") update({ semester: c.data });
    }
    const logged = cards.flatMap((c) => (c.kind === "expense" ? [c.data] : []));
    if (logged.length) update({ expenses: [...logged, ...(profile.expenses ?? [])] });
  };

  const send = async (text: string, base: Turn[] = turns) => {
    if (!text.trim() || busy) return;
    const next: Turn[] = [...base, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const data = await postChat({ messages: next.map(({ role, content }) => ({ role, content })), profile });
      setTurns([...next, { role: "assistant", content: data.reply, cards: data.cards }]);
      apply(data.cards);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "You're sending messages quickly. Wait a few minutes and try again."
          : err instanceof ApiError && err.status
            ? `CampusWizard hit a server error (${err.status}). Try again.`
            : "Couldn't reach CampusWizard. Check your connection and try again.",
      );
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
            <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-bu"><IconSparkle size={24} /></span>
              <p className="text-lg font-bold leading-snug">Big semester. Small questions welcome.</p>
              <p className="mt-1 text-sm text-zinc-500">CampusWizard can see your schedule, syllabi and budget.</p>
              <ul className="mt-4 space-y-2 text-left">
                {suggestions.map((q) => (
                  <li key={q}>
                    <button onClick={() => send(q)} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 text-left text-sm text-zinc-700 transition-colors duration-150 hover:border-red-200 hover:bg-red-50/40">
                      <span className="text-zinc-400">○</span><span className="flex-1">{q}</span><span className="text-zinc-400">↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`cw-enter ${t.role === "user" ? "flex justify-end" : ""}`}>
            {t.role === "user" ? (
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-200/70 px-4 py-2.5 text-[15px] text-zinc-900">{t.content}</p>
            ) : (
              <div className="w-full">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-700"><span className="text-bu"><IconSparkle size={15} /></span> CampusWizard</p>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800">{t.content.replace(/\*\*/g, "")}</p>
                {t.cards && t.cards.length > 0 && <div className="mt-3 space-y-2">{t.cards.map(card)}</div>}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm text-zinc-500">
            <span className="text-bu"><IconSparkle size={15} /></span> CampusWizard is thinking
            <span className="inline-flex gap-0.5" aria-hidden="true">{[0, 1, 2].map((d) => <span key={d} className="h-1 w-1 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${d * 150}ms` }} />)}</span>
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="font-semibold">That response didn&apos;t come through.</p>
            <p className="mt-0.5 text-sm text-zinc-500">{error} Your message is still here.</p>
            <button
              onClick={() => {
                const last = turns[turns.length - 1];
                if (last?.role === "user") send(last.content, turns.slice(0, -1));
              }}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm font-semibold"
            >
              ↻ Retry message
            </button>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className={`${compact ? "" : "sticky bottom-20"} mt-3`}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2 pl-4 shadow-md focus-within:border-zinc-400">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your semester or schedule…" aria-label="Message CampusWizard" maxLength={500} className="min-h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          <button disabled={busy || !input.trim()} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bu text-white transition-colors hover:bg-red-700 disabled:bg-zinc-200 disabled:text-zinc-400">
            <IconSend size={18} />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-zinc-400">AI can make mistakes. Check course details with your advisor.</p>
      </form>
    </div>
  );
}
