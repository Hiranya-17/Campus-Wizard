"use client";
import { useEffect, useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { fmtTime } from "@/lib/format";
import type { ExtractedEvent } from "@/lib/types";

type Scanned = ExtractedEvent & { emailId: string };

/**
 * "Scan my Gmail for club meetings": searches the student's last 30 days of club/event emails on the server
 * and lists every meeting found with the email it came from. Shows how to connect Gmail when it isn't.
 */
export function GmailScan({ onAdd }: { onAdd: (e: ExtractedEvent) => void }) {
  const [state, setState] = useState<{ available: boolean; loggedIn: boolean; connected: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ scanned: number; events: Scanned[] } | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/auth/me").then((r) => r.json()), fetch("/api/google/status").then((r) => r.json())])
      .then(([me, status]) => setState({ available: Boolean(me.googleAvailable), loggedIn: Boolean(me.user), connected: Boolean(status.connected) }))
      .catch(() => setState({ available: false, loggedIn: false, connected: false }));
  }, []);

  if (!state || !state.available) return null; // Google isn't set up on this server

  const scan = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setAdded(new Set());
    try {
      const res = await fetch("/api/google/gmail/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't scan your Gmail.");
    }
    setBusy(false);
  };

  return (
    <Card className="space-y-2 !p-3">
      <p className="text-sm font-semibold">Find club meetings in your Gmail</p>
      {!state.loggedIn ? (
        <p className="text-xs text-zinc-500">
          <a href="/account" className="font-semibold text-bu">Log in</a> and connect Gmail, and CampusWizard will search your inbox for club meetings for you.
        </p>
      ) : !state.connected ? (
        <>
          <p className="text-xs text-zinc-500">Connect Gmail (read-only) and CampusWizard will search your recent club and event emails for meetings.</p>
          <a href="/api/google/auth?connect=1" className="block w-full rounded-xl border border-zinc-300 bg-white py-2.5 text-center text-sm font-semibold">
            Connect Gmail to scan your inbox
          </a>
        </>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            Searches your last 30 days of email for club and event emails (meetings, workshops, info sessions; promotions are skipped),
            reads up to 15 of them, and lists the meetings it finds. Nothing is changed in your inbox.
          </p>
          <Button onClick={scan} disabled={busy}>{busy ? "Searching your Gmail…" : "Scan my Gmail for club meetings"}</Button>
        </>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {result && (
        <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
          Read {result.scanned} club/event email{result.scanned === 1 ? "" : "s"} from the last 30 days and found {result.events.length} meeting{result.events.length === 1 ? "" : "s"}.
        </p>
      )}
      {result && result.events.length > 0 && (
        <ul className="space-y-1">
          {result.events.map((e, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{e.title}</span>{" "}
                <span className="text-zinc-500">
                  {e.weekday ? `every ${e.weekday}` : e.date} {e.start != null ? fmtTime(e.start) : ""}{e.location ? ` · ${e.location}` : ""}
                </span>
                <span className="block truncate text-[11px] text-zinc-400">from: {e.source}</span>
              </span>
              {e.weekday && e.start != null ? (
                added.has(i) ? (
                  <span className="shrink-0 font-semibold text-green-700">Added ✓</span>
                ) : (
                  <button className="shrink-0 font-semibold text-bu" onClick={() => { onAdd(e); setAdded((s) => new Set(s).add(i)); }}>Add weekly</button>
                )
              ) : (
                <Pill>one-time</Pill>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
