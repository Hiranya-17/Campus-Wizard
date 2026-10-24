"use client";
import { useEffect, useReducer } from "react";
import { Card, Pill } from "@/components/ui";
import { fmtTime } from "@/lib/format";
import type { WeekEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types mirroring the API response
// ---------------------------------------------------------------------------

interface EventResult {
  eventId: string;
  title: string;
  status: "created" | "restored" | "skipped" | "failed";
  googleId?: string;
  error?: string;
}

interface ExportResult {
  created: number;
  restored: number;
  skipped: number;
  failed: EventResult[];
  results: EventResult[];
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type Phase =
  | "idle"           // Google not connected, or no plan yet
  | "preview"        // showing event list, waiting for confirm
  | "exporting"      // request in flight
  | "done"           // finished, showing results
  | "error";         // top-level error (auth, network)

interface State {
  connected: boolean | null;
  phase: Phase;
  result: ExportResult | null;
  topError: string | null;
}

type Action =
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SHOW_PREVIEW" }
  | { type: "CANCEL" }
  | { type: "EXPORT_START" }
  | { type: "EXPORT_DONE"; result: ExportResult }
  | { type: "EXPORT_ERROR"; error: string }
  | { type: "RESET" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_CONNECTED":
      return { ...s, connected: a.connected, phase: a.connected ? "preview" : "idle" };
    case "SHOW_PREVIEW":
      return { ...s, phase: "preview", result: null, topError: null };
    case "CANCEL":
      return { ...s, phase: "preview", result: null, topError: null };
    case "EXPORT_START":
      return { ...s, phase: "exporting" };
    case "EXPORT_DONE":
      return { ...s, phase: "done", result: a.result };
    case "EXPORT_ERROR":
      return { ...s, phase: "error", topError: a.error };
    case "RESET":
      return { ...s, phase: "preview", result: null, topError: null };
    default:
      return s;
  }
}

const INIT: State = { connected: null, phase: "idle", result: null, topError: null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TZ_LABEL = "Eastern Time (Boston)";

/** Short date label for a day offset from weekOf Monday, e.g. "Mon Oct 26" */
function dateLabel(weekOf: string, day: WeekEvent["day"]): string {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
  const [y, m, d] = weekOf.split("-").map(Number);
  const offset = DAYS.indexOf(day as (typeof DAYS)[number]);
  const date = new Date(Date.UTC(y, m - 1, d + offset));
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const KIND_COLOR: Record<string, string> = {
  class: "bg-red-50 border-l-red-400",
  club: "bg-violet-50 border-l-violet-400",
  exam: "bg-orange-50 border-l-orange-400",
  study: "bg-sky-50 border-l-sky-400",
  gym: "bg-emerald-50 border-l-emerald-400",
  meal: "bg-amber-50 border-l-amber-400",
  task: "bg-pink-50 border-l-pink-400",
  travel: "bg-zinc-50 border-l-zinc-300",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CalendarExportProps {
  weekOf: string;
  events: WeekEvent[];
  /** Called if the user dismisses the whole panel (goes back to .ics) */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarExport({ weekOf, events, onClose }: CalendarExportProps) {
  const [state, dispatch] = useReducer(reducer, INIT);

  // Check Google connection on mount
  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => dispatch({ type: "SET_CONNECTED", connected: Boolean(d.connected) }))
      .catch(() => dispatch({ type: "SET_CONNECTED", connected: false }));
  }, []);

  if (state.connected === null || !state.connected) return null;

  // Filter out sleep events — same as .ics
  const exportable = events.filter((e) => e.kind !== "sleep");

  async function runExport() {
    dispatch({ type: "EXPORT_START" });
    try {
      const res = await fetch("/api/google/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOf, events: exportable }),
      });

      if (res.status === 401) {
        dispatch({ type: "EXPORT_ERROR", error: "Your Google session expired. Please disconnect and reconnect Google from your account page." });
        return;
      }

      const data = await res.json() as ExportResult | { error: string };

      if (!res.ok) {
        const errMsg = "error" in data ? data.error : "Calendar export failed.";
        dispatch({ type: "EXPORT_ERROR", error: errMsg });
        return;
      }

      dispatch({ type: "EXPORT_DONE", result: data as ExportResult });
    } catch {
      dispatch({ type: "EXPORT_ERROR", error: "Network error — could not reach the server." });
    }
  }

  const { phase, result, topError } = state;

  // ---- preview phase ----
  if (phase === "preview") {
    return (
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Export to Google Calendar</p>
          {onClose && (
            <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-600">
              Use .ics instead
            </button>
          )}
        </div>

        <p className="text-xs text-zinc-500">
          {exportable.length} event{exportable.length !== 1 ? "s" : ""} will be added to your primary Google Calendar as{" "}
          <span className="font-medium">{TZ_LABEL}</span>. Already-exported events are skipped automatically.
        </p>

        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {exportable.map((e) => (
            <li
              key={e.id}
              className={`flex items-center gap-2 rounded-lg border-l-4 px-2 py-1.5 text-xs ${KIND_COLOR[e.kind] ?? "bg-zinc-50 border-l-zinc-300"}`}
            >
              <span className="w-[76px] shrink-0 font-medium text-zinc-600">{dateLabel(weekOf, e.day)}</span>
              <span className="w-[90px] shrink-0 tabular-nums text-zinc-500">
                {fmtTime(e.start)}–{fmtTime(Math.min(e.end, 1439))}
              </span>
              <span className="flex-1 truncate font-medium">{e.title}</span>
              {e.location && (
                <span className="hidden truncate text-zinc-400 sm:block">{e.location}</span>
              )}
            </li>
          ))}
        </ul>

        <p className="text-[11px] text-zinc-400">
          Timezone: <span className="font-medium">America/New_York</span> · Week of{" "}
          {new Date(weekOf + "T00:00:00Z").toLocaleDateString("en-US", {
            timeZone: "UTC", month: "long", day: "numeric", year: "numeric",
          })}
        </p>

        <button
          onClick={runExport}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-bu py-3 text-sm font-semibold text-white hover:bg-red-700"
        >
          {/* Google calendar icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="17" rx="2" stroke="white" strokeWidth="1.5" />
            <path d="M3 9h18" stroke="white" strokeWidth="1.5" />
            <path d="M8 2v4M16 2v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add {exportable.length} events to Google Calendar
        </button>
      </Card>
    );
  }

  // ---- exporting phase ----
  if (phase === "exporting") {
    return (
      <Card>
        <p className="text-center text-sm text-zinc-500 animate-pulse">
          Exporting to Google Calendar…
        </p>
      </Card>
    );
  }

  // ---- error phase ----
  if (phase === "error") {
    return (
      <Card className="space-y-3">
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{topError}</p>
        <button onClick={() => dispatch({ type: "RESET" })} className="text-xs text-bu hover:underline">
          Try again
        </button>
      </Card>
    );
  }

  // ---- done phase ----
  if (phase === "done" && result) {
    const addedCount = result.created + result.restored;
    const allSkipped = addedCount === 0 && result.skipped === exportable.length && result.failed.length === 0;
    const allAdded = addedCount === exportable.length && result.failed.length === 0;

    return (
      <Card className="space-y-3">
        {/* Summary banner */}
        {allAdded && result.restored === 0 && (
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
            ✓ All {result.created} events added to Google Calendar.
          </p>
        )}
        {allAdded && result.restored > 0 && (
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
            ✓ {result.created > 0 ? `${result.created} added` : ""}
            {result.created > 0 && result.restored > 0 ? " · " : ""}
            {result.restored > 0 ? `${result.restored} restored` : ""}
          </p>
        )}
        {allSkipped && (
          <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            All events were already in your calendar — nothing to add.
          </p>
        )}
        {!allAdded && !allSkipped && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
            <p className="font-semibold text-amber-800">
              {[
                result.created > 0 && `${result.created} added`,
                result.restored > 0 && `${result.restored} restored`,
                result.skipped > 0 && `${result.skipped} already existed`,
                result.failed.length > 0 && `${result.failed.length} failed`,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}

        {/* Per-event results */}
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {result.results.map((r) => (
            <li key={r.eventId} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0">
                {(r.status === "created" || r.status === "restored") && <span className="text-green-600">✓</span>}
                {r.status === "skipped" && <span className="text-zinc-400">–</span>}
                {r.status === "failed" && <span className="text-red-600">✗</span>}
              </span>
              <span className={`flex-1 ${r.status === "failed" ? "text-red-700" : r.status === "skipped" ? "text-zinc-400" : "text-zinc-700"}`}>
                {r.title}
                {r.status === "restored" && (
                  <span className="ml-1 text-zinc-400">(was deleted — restored)</span>
                )}
                {r.status === "failed" && r.error && (
                  <span className="ml-1 text-red-500">({r.error})</span>
                )}
                {r.status === "skipped" && (
                  <span className="ml-1 text-zinc-400">(already in calendar)</span>
                )}
              </span>
              <Pill tone={r.status === "created" || r.status === "restored" ? "green" : r.status === "failed" ? "red" : "zinc"}>
                {r.status}
              </Pill>
            </li>
          ))}
        </ul>

        {/* Failed events: offer to retry */}
        {result.failed.length > 0 && (
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="text-xs text-bu hover:underline"
          >
            Retry failed events
          </button>
        )}

        <button
          onClick={() => dispatch({ type: "RESET" })}
          className="text-xs text-zinc-400 hover:underline"
        >
          Export again
        </button>
      </Card>
    );
  }

  return null;
}
