"use client";
import { useEffect, useRef, useState } from "react";
import { Card, Pill } from "@/components/ui";
import { fmtTime } from "@/lib/format";
import type { Day, WeekEvent } from "@/lib/types";
import { DAYS } from "@/lib/types";

interface Leg {
  to: string;
  toPlace: string;
  fromPlace: string;
  arriveBy: number;
  leaveBy: number;
  mode: "walk" | "green-line";
  walkMinutes: number;
  transit?: { board: string; alight: string; direction: string; departs: number; live: boolean };
  weather?: string;
  note?: string;
}

const nowMinutes = () => new Date().getHours() * 60 + new Date().getMinutes();

/**
 * Today's route between classes with "leave by" times. If today has no classes,
 * shows the next class day so the demo always has something to show.
 */
export function RouteCard({ events, home, onHomeChange }: { events: WeekEvent[]; home: string; onHomeChange: (code: string) => void }) {
  const [places, setPlaces] = useState<{ code: string; name: string }[]>([]);
  const [legs, setLegs] = useState<Leg[] | null>(null);
  const [now, setNow] = useState(nowMinutes());
  const [reminders, setReminders] = useState(false);
  const timers = useRef<number[]>([]);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const withPlace = (d: Day) => events.filter((e) => e.day === d && e.location && ["class", "club", "exam"].includes(e.kind));
  const offset = [0, 1, 2, 3, 4, 5, 6].find((i) => withPlace(DAYS[(todayIdx + i) % 7]).length > 0) ?? 0;
  const day = DAYS[(todayIdx + offset) % 7];
  const isToday = offset === 0;
  const stops = withPlace(day);
  const key = JSON.stringify([home, day, stops.map((s) => s.id)]);

  useEffect(() => {
    fetch("/api/transit").then((r) => r.json()).then(setPlaces);
    const t = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!stops.length) return setLegs([]);
    fetch("/api/transit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: home,
        stops: stops.map((s) => ({ title: s.title, start: s.start, end: s.end, location: s.location })),
        now: isToday ? now : 0,
      }),
    })
      .then((r) => r.json())
      .then((d) => setLegs(d.legs));
    // refresh live train times every minute; recompute when the day's stops change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isToday ? now : 0]);

  const upcoming = (legs ?? []).filter((l) => !isToday || l.arriveBy > now);
  const next = upcoming[0];

  const remind = async () => {
    if (!("Notification" in window)) return alert("This browser can't show notifications.");
    if ((await Notification.requestPermission()) !== "granted") return;
    timers.current.forEach(clearTimeout);
    timers.current = upcoming
      .filter(() => isToday)
      .map((l) => {
        const ms = (l.leaveBy - 2 - nowMinutes()) * 60_000;
        return window.setTimeout(
          () => new Notification(`Leave by ${fmtTime(l.leaveBy)}`, { body: `${l.to} at ${l.toPlace}${l.transit ? ` · ${l.transit.direction} Green Line from ${l.transit.board}` : ` · ${l.walkMinutes} min walk`}` }),
          Math.max(0, ms),
        );
      });
    setReminders(true);
  };

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 text-xs">
        <span className="text-zinc-500">Starting from</span>
        <select value={home} onChange={(e) => onHomeChange(e.target.value)} className="min-w-0 flex-1 rounded-md border border-zinc-200 px-1 py-0.5">
          {places.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </div>

      {legs === null ? (
        <p className="p-4 text-sm text-zinc-400">Checking the T…</p>
      ) : !next ? (
        <p className="p-4 text-sm text-zinc-500">No more classes today.</p>
      ) : (
        <>
          <div className="bg-bu px-4 py-3 text-white">
            <p className="text-xs opacity-80">{isToday ? "Next" : `${day}'s first class`}</p>
            <p className="text-2xl font-bold">Leave by {fmtTime(next.leaveBy)}</p>
            <p className="text-sm">
              {next.to} · {next.toPlace} at {fmtTime(next.arriveBy)}
            </p>
            <p className="mt-1 text-xs opacity-90">
              {next.transit
                ? `🚋 Green Line ${next.transit.direction} from ${next.transit.board} at ${fmtTime(next.transit.departs)}${next.transit.live ? " (live)" : ""} → ${next.transit.alight}`
                : `🚶 ${next.walkMinutes} min walk from ${next.fromPlace}`}
            </p>
            {(next.weather || next.note) && <p className="mt-1 text-xs opacity-90">{[next.weather, next.note].filter(Boolean).join(" · ")}</p>}
          </div>
          <ul className="divide-y divide-zinc-100">
            {upcoming.slice(1).map((l) => (
              <li key={l.to + l.arriveBy} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-16 shrink-0 text-xs tabular-nums text-zinc-500">{fmtTime(l.leaveBy)}</span>
                <span className="flex-1">
                  {l.to} <span className="text-xs text-zinc-500">· {l.toPlace}</span>
                </span>
                <Pill tone={l.mode === "walk" ? "zinc" : "red"}>{l.mode === "walk" ? `${l.walkMinutes}m walk` : `T ${l.transit?.board}`}</Pill>
              </li>
            ))}
          </ul>
          {isToday && (
            <button onClick={remind} className="w-full border-t border-zinc-100 py-2 text-sm font-semibold text-bu">
              {reminders ? "Reminders on ✓" : "🔔 Remind me when to leave"}
            </button>
          )}
        </>
      )}
      <p className="border-t border-zinc-100 px-4 py-1.5 text-[10px] text-zinc-400">
        Live trains from the MBTA, weather from the National Weather Service. BU Shuttle times: Terrier Transit app.
      </p>
    </Card>
  );
}
