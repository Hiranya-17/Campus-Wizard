import { NextResponse } from "next/server";
import { getBuildings, planRoute, type RouteStop } from "@/lib/transit";

/** Minutes after midnight in Boston right now. */
function bostonNow(): number {
  const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false }).split(":").map(Number);
  return h * 60 + m;
}

// POST /api/transit  { from: "WARREN", stops: RouteStop[], now?: minutes } -> { legs, weather, now }
// GET  /api/transit  -> places Rhett knows (for "where do you live" pickers)
export async function POST(req: Request) {
  const { from = "WARREN", stops = [], now } = (await req.json()) as { from?: string; stops?: RouteStop[]; now?: number };
  const at = now ?? bostonNow();
  return NextResponse.json({ ...(await planRoute(from, stops, at)), now: at });
}

export async function GET() {
  return NextResponse.json(Object.entries(getBuildings()).map(([code, b]) => ({ code, name: b.name })));
}
