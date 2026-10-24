import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Minutes } from "@/lib/types";

// ---------- places ----------

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

let buildings: Record<string, Place & { address: string }> | null = null;
export function getBuildings() {
  if (!buildings) buildings = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "buildings.json"), "utf8"));
  return buildings!;
}

/** "PHO 203" -> Photonics Center. Unknown codes return null. */
export function placeFor(location: string | undefined): (Place & { code: string }) | null {
  if (!location) return null;
  const code = location.trim().split(/\s+/)[0].toUpperCase();
  const b = getBuildings()[code];
  return b ? { ...b, code } : null;
}

/** Green Line B stops along Comm Ave, east to west (MBTA ids). */
const GREEN_B = [
  { id: "place-kencl", name: "Kenmore", lat: 42.348949, lon: -71.095169 },
  { id: "place-bland", name: "Blandford Street", lat: 42.349293, lon: -71.100258 },
  { id: "place-buest", name: "BU East", lat: 42.349735, lon: -71.103889 },
  { id: "place-bucen", name: "BU Central", lat: 42.350082, lon: -71.106865 },
  { id: "place-amory", name: "Amory Street", lat: 42.350992, lon: -71.114748 },
  { id: "place-babck", name: "Babcock Street", lat: 42.351616, lon: -71.119924 },
];

function meters(a: Place, b: Place) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Street walking at ~80 m/min, with 25% detour for sidewalks and crossings. */
export const walkMinutes = (a: Place, b: Place) => Math.max(2, Math.ceil((meters(a, b) * 1.25) / 80));

const nearestStop = (p: Place) => GREEN_B.reduce((best, s) => (meters(p, s) < meters(p, best) ? s : best));

// ---------- live data ----------

/** Next departures (minutes after midnight, Boston time) from a Green B stop. direction 0 = westbound, 1 = eastbound. */
async function departures(stopId: string, direction: 0 | 1): Promise<Minutes[]> {
  const url = `https://api-v3.mbta.com/predictions?filter[stop]=${stopId}&filter[route]=Green-B&filter[direction_id]=${direction}&sort=departure_time&page[limit]=6`;
  try {
    const res = await fetch(url, { headers: process.env.MBTA_API_KEY ? { "x-api-key": process.env.MBTA_API_KEY } : {}, next: { revalidate: 30 } });
    const data = await res.json();
    return (data.data ?? [])
      .map((p: { attributes: { departure_time: string | null } }) => p.attributes.departure_time)
      .filter(Boolean)
      .map((t: string) => {
        const [, hh, mm] = t.match(/T(\d{2}):(\d{2})/)!;
        return Number(hh) * 60 + Number(mm);
      });
  } catch {
    return [];
  }
}

export interface HourWeather {
  hour: number; // 0-23 Boston time
  tempF: number;
  rainChance: number;
  short: string; // "Light Rain"
}

/** National Weather Service hourly forecast for BU, today only. */
export async function weatherToday(): Promise<HourWeather[]> {
  try {
    const res = await fetch("https://api.weather.gov/gridpoints/BOX/70,100/forecast/hourly", {
      headers: { "User-Agent": "rhett-bu-hackathon (student project)" },
      next: { revalidate: 900 },
    });
    const data = await res.json();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    return (data.properties?.periods ?? [])
      .filter((p: { startTime: string }) => p.startTime.startsWith(today))
      .map((p: { startTime: string; temperature: number; probabilityOfPrecipitation?: { value: number | null }; shortForecast: string }) => ({
        hour: Number(p.startTime.slice(11, 13)),
        tempF: p.temperature,
        rainChance: p.probabilityOfPrecipitation?.value ?? 0,
        short: p.shortForecast,
      }));
  } catch {
    return [];
  }
}

// ---------- routing ----------

export interface RouteStop {
  title: string;
  start: Minutes;
  end: Minutes;
  location?: string;
}

export interface Leg {
  to: string; // event title
  toPlace: string; // "Photonics Center"
  fromPlace: string;
  arriveBy: Minutes; // event start
  leaveBy: Minutes;
  mode: "walk" | "green-line";
  walkMinutes: number;
  transit?: { board: string; alight: string; direction: "westbound" | "eastbound"; departs: Minutes; live: boolean };
  weather?: string; // "Light Rain, 62% chance, 48°F"
  note?: string;
}

const BUFFER = 5; // arrive five minutes early

export async function planRoute(fromCode: string, stops: RouteStop[], now: Minutes): Promise<{ legs: Leg[]; weather: HourWeather[] }> {
  const weather = await weatherToday();
  const legs: Leg[] = [];
  let from: Place & { code?: string } = getBuildings()[fromCode] ?? getBuildings().WARREN;

  for (const stop of [...stops].sort((a, b) => a.start - b.start)) {
    const to = placeFor(stop.location);
    if (!to) {
      legs.push({ to: stop.title, toPlace: stop.location ?? "Unknown", fromPlace: from.name, arriveBy: stop.start, leaveBy: stop.start - 10 - BUFFER, mode: "walk", walkMinutes: 10, note: "Building not on Rhett's map yet; assuming a 10 minute walk." });
      continue;
    }
    const walk = walkMinutes(from, to);
    const w = weather.find((h) => h.hour === Math.floor((stop.start - walk) / 60));
    const badWeather = !!w && (w.rainChance >= 50 || w.tempF <= 25);
    const leg: Leg = {
      to: stop.title, toPlace: to.name, fromPlace: from.name, arriveBy: stop.start,
      leaveBy: stop.start - walk - BUFFER, mode: "walk", walkMinutes: walk,
      weather: w ? `${w.short}, ${w.rainChance}% rain, ${w.tempF}°F` : undefined,
    };

    // Consider the Green Line when the walk is long or the weather is bad.
    const board = nearestStop(from), alight = nearestStop(to);
    if (board.id !== alight.id && (walk >= 12 || badWeather)) {
      const iA = GREEN_B.findIndex((s) => s.id === board.id), iB = GREEN_B.findIndex((s) => s.id === alight.id);
      const direction = iB > iA ? 0 : 1;
      const toStop = walkMinutes(from, board), fromStop = walkMinutes(alight, to);
      const ride = Math.abs(iB - iA) * 2 + 1;
      const latestDeparture = stop.start - BUFFER - fromStop - ride;
      const soon = latestDeparture - now < 75; // MBTA predictions only cover the next hour or so
      const live = soon ? (await departures(board.id, direction as 0 | 1)).filter((t) => t >= now + toStop && t <= latestDeparture) : [];
      const departs = live.length ? live[live.length - 1] : latestDeparture - 4; // trains every ~6-8 minutes
      const tLeave = departs - toStop;
      if (badWeather || tLeave > leg.leaveBy) {
        Object.assign(leg, {
          mode: "green-line",
          leaveBy: tLeave,
          transit: { board: board.name, alight: alight.name, direction: direction === 0 ? "westbound" : "eastbound", departs, live: live.length > 0 },
          note: badWeather ? "Bad weather, so take the T." : undefined,
        });
      }
    }
    if (leg.leaveBy < now && stop.start > now) leg.note = `${leg.note ? leg.note + " " : ""}You're running late, leave now.`;
    legs.push(leg);
    from = to;
  }
  return { legs, weather };
}
