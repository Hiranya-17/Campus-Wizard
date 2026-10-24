"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { Card, Pill } from "@/components/ui";
import { fmtTime, money } from "@/lib/format";
import type { Expense, ExtractedEvent, WeekEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  kind: "club" | "order" | "other";
  account: string; // "primary" or the extra inbox's address
}

interface Inbox {
  account: string;
  email: string | null;
  primary: boolean;
}

const MAX_EXTRA_INBOXES = 4; // matches MAX_MAILBOXES on the server
const inboxLabel = (i: Inbox) => i.email ?? "Main Google account";
/** Message ids are only unique within one inbox. */
const emailKey = (e: { account: string; id: string }) => `${e.account}:${e.id}`;

/** What the Google callback reports after "Add another email". */
const INBOX_NOTICE: Record<string, string> = {
  added: "Inbox added. Its order confirmations show up below.",
  already: "That address is already your main Google connection.",
  full: `You can link up to ${MAX_EXTRA_INBOXES} extra inboxes. Remove one on the Account page first.`,
};

type ExtractMode = "events" | "expenses";

interface ExtractedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  events: ExtractedEvent[];
  expenses: Expense[];
  engine: "gemini" | "rules";
  /** Which items the user has already saved */
  savedEventIds: Set<string>;
  savedExpenseIds: Set<string>;
}

interface State {
  /** null = not yet checked, false = no Google connection, true = connected */
  connected: boolean | null;
  /** Logged in and Google is set up on this server, so "Connect an inbox" can work */
  canConnect: boolean;
  inboxes: Inbox[];
  /** "all" or one inbox's account */
  filter: string;
  /** Inboxes that couldn't be read on the last load */
  failed: string[];
  emails: EmailSummary[];
  loadingList: boolean;
  listError: string | null;
  /** id of email currently being fetched + extracted */
  extracting: string | null;
  /** Map from message id → extraction result */
  extracted: Map<string, ExtractedEmail>;
  /** Which email row is expanded */
  expanded: string | null;
}

type Action =
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SET_INBOXES"; inboxes: Inbox[]; canConnect: boolean }
  | { type: "SET_FILTER"; filter: string }
  | { type: "LOAD_LIST" }
  | { type: "LIST_OK"; emails: EmailSummary[]; failed: string[] }
  | { type: "LIST_ERR"; error: string }
  | { type: "EXTRACT_START"; id: string }
  | { type: "EXTRACT_OK"; result: ExtractedEmail }
  | { type: "EXTRACT_ERR"; id: string }
  | { type: "TOGGLE_EXPAND"; id: string }
  | { type: "SAVE_EVENT"; emailId: string; eventKey: string }
  | { type: "SAVE_EXPENSE"; emailId: string; expenseId: string };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_CONNECTED":
      return { ...s, connected: a.connected };
    case "SET_INBOXES":
      return { ...s, inboxes: a.inboxes, canConnect: a.canConnect, connected: a.inboxes.length > 0 };
    case "SET_FILTER":
      return { ...s, filter: a.filter };
    case "LOAD_LIST":
      return { ...s, loadingList: true, listError: null, emails: [] };
    case "LIST_OK":
      return { ...s, loadingList: false, emails: a.emails, failed: a.failed };
    case "LIST_ERR":
      return { ...s, loadingList: false, listError: a.error };
    case "EXTRACT_START":
      return { ...s, extracting: a.id, expanded: a.id };
    case "EXTRACT_OK": {
      const next = new Map(s.extracted);
      next.set(a.result.id, a.result);
      return { ...s, extracting: null, extracted: next, expanded: a.result.id };
    }
    case "EXTRACT_ERR":
      return { ...s, extracting: null };
    case "TOGGLE_EXPAND":
      return { ...s, expanded: s.expanded === a.id ? null : a.id };
    case "SAVE_EVENT": {
      const next = new Map(s.extracted);
      const entry = next.get(a.emailId);
      if (!entry) return s;
      entry.savedEventIds = new Set([...entry.savedEventIds, a.eventKey]);
      return { ...s, extracted: next };
    }
    case "SAVE_EXPENSE": {
      const next = new Map(s.extracted);
      const entry = next.get(a.emailId);
      if (!entry) return s;
      entry.savedExpenseIds = new Set([...entry.savedExpenseIds, a.expenseId]);
      return { ...s, extracted: next };
    }
    default:
      return s;
  }
}

const init: State = {
  connected: null,
  canConnect: false,
  inboxes: [],
  filter: "all",
  failed: [],
  emails: [],
  loadingList: false,
  listError: null,
  extracting: null,
  extracted: new Map(),
  expanded: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function eventKey(e: ExtractedEvent): string {
  return `${e.title}|${e.date ?? ""}|${e.weekday ?? ""}|${e.start ?? ""}`;
}

const KIND_PILL: Record<string, "zinc" | "amber" | "red"> = {
  club: "zinc",
  exam: "amber",
  deadline: "amber",
  class: "red",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GmailImportProps {
  /** What to extract: club/syllabus events or order/receipt expenses */
  mode: ExtractMode;
  /** Called when the user saves one or more events to their clubs list */
  onSaveEvents?: (events: WeekEvent[]) => void;
  /** Called when the user saves one or more expenses */
  onSaveExpenses?: (expenses: Expense[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GmailImport({ mode, onSaveEvents, onSaveExpenses }: GmailImportProps) {
  const [state, dispatch] = useReducer(reducer, init);
  const [notice, setNotice] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Check which inboxes are linked once on mount, and show the result of an "Add another email" round trip
  useEffect(() => {
    Promise.all([fetch("/api/google/status").then((r) => r.json()), fetch("/api/auth/me").then((r) => r.json())])
      .then(([status, me]) =>
        dispatch({ type: "SET_INBOXES", inboxes: status.inboxes ?? [], canConnect: Boolean(me.user && me.googleAvailable) }),
      )
      .catch(() => dispatch({ type: "SET_CONNECTED", connected: false }));
    const url = new URL(window.location.href);
    const result = url.searchParams.get("inbox");
    if (result && INBOX_NOTICE[result]) {
      setNotice(INBOX_NOTICE[result]);
      url.searchParams.delete("inbox");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);

  // Auto-load emails when we confirm the user is connected
  useEffect(() => {
    if (state.connected && !loadedRef.current) {
      loadedRef.current = true;
      loadEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.connected]);

  if (state.connected === null) return null; // still checking
  if (!state.connected) {
    if (!state.canConnect) return null; // guests and servers without Google: nothing to connect
    return (
      <Card className="space-y-2">
        <p className="text-sm font-semibold">Import from Gmail</p>
        <p className="text-xs text-zinc-500">
          Link the inbox you shop with (read-only) and CampusWizard finds your {mode === "expenses" ? "order confirmations" : "club emails"}. You can add more than one address.
        </p>
        <a href="/api/google/auth?mailbox=1" className="block w-full rounded-xl border border-zinc-300 bg-white py-2.5 text-center text-sm font-semibold">
          Connect an inbox
        </a>
      </Card>
    );
  }

  // ---- data fetching ----

  async function loadEmails() {
    dispatch({ type: "LOAD_LIST" });
    // Tailor the Gmail query to the mode
    const q =
      mode === "expenses"
        ? "in:inbox newer_than:30d (order confirmation OR receipt OR shipped OR invoice)"
        : "in:inbox newer_than:30d";
    try {
      const res = await fetch(`/api/google/gmail?q=${encodeURIComponent(q)}&max=30&account=all`);
      if (res.status === 401) { dispatch({ type: "LIST_ERR", error: "Google access expired. Reconnect your inbox on the Account page." }); return; }
      const data = await res.json() as { messages?: EmailSummary[]; failed?: string[]; error?: string };
      if (data.error) { dispatch({ type: "LIST_ERR", error: data.error }); return; }
      dispatch({ type: "LIST_OK", emails: data.messages ?? [], failed: data.failed ?? [] });
    } catch {
      dispatch({ type: "LIST_ERR", error: "Could not reach Gmail." });
    }
  }

  async function extractEmail(summary: EmailSummary) {
    if (state.extracting) return; // don't double-fetch
    const key = emailKey(summary);
    // If already extracted, just toggle expand
    if (state.extracted.has(key)) {
      dispatch({ type: "TOGGLE_EXPAND", id: key });
      return;
    }
    dispatch({ type: "EXTRACT_START", id: key });
    try {
      // 1. Fetch full body from the inbox it came from
      const bodyRes = await fetch(`/api/google/gmail/${summary.id}?account=${encodeURIComponent(summary.account)}`);
      if (!bodyRes.ok) throw new Error(`${bodyRes.status}`);
      const { message } = await bodyRes.json() as { message: { text: string; kind: string } };

      // 2. Run the appropriate extract endpoint
      let events: ExtractedEvent[] = [];
      let expenses: Expense[] = [];
      let engine: "gemini" | "rules" = "rules";

      if (mode === "events") {
        const extRes = await fetch("/api/extract-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "email" as const,
            text: message.text,
            source: `${summary.from} — ${summary.subject}`,
          }),
        });
        const data = await extRes.json() as { events: ExtractedEvent[]; engine: "gemini" | "rules" };
        events = data.events;
        engine = data.engine;
      } else {
        const extRes = await fetch("/api/expenses/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message.text }),
        });
        const data = await extRes.json() as { expenses: Expense[]; engine: "gemini" | "rules" };
        expenses = data.expenses;
        engine = data.engine;
      }

      dispatch({
        type: "EXTRACT_OK",
        result: {
          id: key,
          subject: summary.subject,
          from: summary.from,
          date: summary.date,
          events,
          expenses,
          engine,
          savedEventIds: new Set(),
          savedExpenseIds: new Set(),
        },
      });
    } catch {
      dispatch({ type: "EXTRACT_ERR", id: key });
    }
  }

  function saveEvent(emailId: string, event: ExtractedEvent) {
    if (!event.weekday || event.start == null) return;
    const we: WeekEvent = {
      id: `gmail-${emailId}-${Date.now()}`,
      title: event.title.slice(0, 60),
      day: event.weekday,
      start: event.start,
      end: event.end ?? event.start + 60,
      kind: event.kind === "exam" ? "exam" : "club",
      location: event.location ?? undefined,
      fixed: true,
    };
    onSaveEvents?.([we]);
    dispatch({ type: "SAVE_EVENT", emailId, eventKey: eventKey(event) });
  }

  function saveExpense(emailId: string, expense: Expense) {
    onSaveExpenses?.([expense]);
    dispatch({ type: "SAVE_EXPENSE", emailId, expenseId: expense.id });
  }

  // ---- rendering helpers ----

  function renderExtracted(entry: ExtractedEmail) {
    if (mode === "events") {
      if (entry.events.length === 0) {
        return <p className="mt-2 text-xs text-zinc-500">No events found in this email.</p>;
      }
      return (
        <ul className="mt-2 space-y-1">
          {entry.events.map((e) => {
            const k = eventKey(e);
            const saved = entry.savedEventIds.has(k);
            const canSave = Boolean(e.weekday && e.start != null);
            return (
              <li key={k} className="flex items-start gap-2 rounded-lg bg-zinc-50 px-2 py-1.5 text-xs">
                <Pill tone={KIND_PILL[e.kind] ?? "zinc"}>{e.kind}</Pill>
                <span className="flex-1 leading-snug">
                  <span className="font-medium">{e.title}</span>
                  <span className="ml-1 text-zinc-500">
                    {e.weekday ?? e.date ?? ""}{e.start != null ? ` · ${fmtTime(e.start)}` : ""}
                    {e.location ? ` · ${e.location}` : ""}
                  </span>
                </span>
                {saved ? (
                  <span className="text-green-700 font-semibold">Saved ✓</span>
                ) : canSave ? (
                  <button
                    className="shrink-0 font-semibold text-bu"
                    onClick={() => saveEvent(entry.id, e)}
                  >
                    Add weekly
                  </button>
                ) : (
                  <span className="text-zinc-400 italic">one-time</span>
                )}
              </li>
            );
          })}
        </ul>
      );
    }

    // expenses mode
    if (entry.expenses.length === 0) {
      return <p className="mt-2 text-xs text-zinc-500">No expenses found in this email.</p>;
    }
    return (
      <ul className="mt-2 space-y-1">
        {entry.expenses.map((e) => {
          const saved = entry.savedExpenseIds.has(e.id);
          return (
            <li key={e.id} className="flex items-center gap-2 rounded-lg bg-green-50 px-2 py-1.5 text-xs">
              <span className="flex-1">
                <span className="font-semibold">{e.merchant}</span>
                <span className="ml-1 text-zinc-500">· {e.category} · {e.date}</span>
              </span>
              <span className="tabular-nums font-semibold">{money(e.amount)}</span>
              {saved ? (
                <span className="text-green-700 font-semibold">Saved ✓</span>
              ) : (
                <button
                  className="font-semibold text-bu"
                  onClick={() => saveExpense(entry.id, e)}
                >
                  Add
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  // ---- main render ----

  const { inboxes, filter, failed, loadingList, listError, extracting, expanded, extracted } = state;
  const modeLabel = mode === "events" ? "club emails" : "order confirmations";
  const emails = filter === "all" ? state.emails : state.emails.filter((e) => e.account === filter);
  const several = inboxes.length > 1;
  const canAddMore = inboxes.filter((i) => !i.primary).length < MAX_EXTRA_INBOXES;
  const chip = (on: boolean) =>
    `inline-flex min-h-8 max-w-full items-center truncate rounded-full border px-3 text-xs font-medium ${on ? "border-bu bg-red-50 text-bu" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"}`;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          Import from Gmail
          <span className="ml-1 font-normal text-zinc-500">— {modeLabel}</span>
        </p>
        <button
          className="text-xs text-bu hover:underline disabled:opacity-40"
          disabled={loadingList}
          onClick={loadEmails}
        >
          {loadingList ? "Loading…" : "Refresh"}
        </button>
      </div>

      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}

      <div className="flex flex-wrap gap-1.5" aria-label="Inboxes">
        {several && (
          <button className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => dispatch({ type: "SET_FILTER", filter: "all" })}>
            All inboxes
          </button>
        )}
        {inboxes.map((i) => (
          <button
            key={i.account}
            className={chip(several && filter === i.account)}
            aria-pressed={several && filter === i.account}
            disabled={!several}
            onClick={() => dispatch({ type: "SET_FILTER", filter: i.account })}
          >
            {inboxLabel(i)}
          </button>
        ))}
        {canAddMore && (
          <a href="/api/google/auth?mailbox=1" className={`${chip(false)} border-dashed font-semibold !text-bu`}>
            + Add another email
          </a>
        )}
      </div>

      {failed.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Couldn&rsquo;t read {failed.join(", ")}. Remove and re-add it on the Account page.
        </p>
      )}

      {listError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{listError}</p>
      )}

      {!loadingList && emails.length === 0 && !listError && (
        <p className="text-xs text-zinc-500">No recent emails found.</p>
      )}

      {emails.length > 0 && (
        <ul className="divide-y divide-zinc-100">
          {emails.map((email) => {
            const key = emailKey(email);
            const isExpanded = expanded === key;
            const isExtracting = extracting === key;
            const entry = extracted.get(key);
            const hasResults = Boolean(entry);
            const inbox = inboxes.find((i) => i.account === email.account);

            return (
              <li key={key} className="py-2">
                {/* Email row — clicking extracts or toggles */}
                <button
                  className="flex w-full items-start gap-2 text-left"
                  onClick={() => extractEmail(email)}
                  disabled={Boolean(extracting) && !isExtracting}
                  aria-expanded={isExpanded}
                >
                  {/* Kind indicator */}
                  <span className="mt-0.5 shrink-0">
                    {mode === "expenses"
                      ? <span className="text-base">🧾</span>
                      : email.kind === "club"
                      ? <span className="text-base">📅</span>
                      : <span className="text-base">✉️</span>}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{email.subject || "(no subject)"}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {email.from.replace(/<.*>/, "").trim()} · {formatDate(email.date)}
                    </span>
                    {several && inbox && <span className="block truncate text-[11px] text-zinc-400">to {inboxLabel(inbox)}</span>}
                    {!isExpanded && !hasResults && (
                      <span className="block truncate text-xs text-zinc-400">{email.snippet}</span>
                    )}
                  </span>

                  <span className="shrink-0 text-xs">
                    {isExtracting
                      ? <span className="text-zinc-400 animate-pulse">Reading…</span>
                      : hasResults
                      ? <span className="text-zinc-400">{isExpanded ? "▲" : "▼"}</span>
                      : <span className="text-bu font-semibold">Scan</span>}
                  </span>
                </button>

                {/* Extracted results — shown when expanded */}
                {isExpanded && entry && renderExtracted(entry)}

                {/* Engine badge */}
                {isExpanded && entry && (
                  <p className="mt-1 text-right text-[10px] text-zinc-400">
                    extracted by {entry.engine}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
