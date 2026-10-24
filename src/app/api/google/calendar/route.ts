import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { exportWeekToCalendar } from "@/lib/google/calendar";
import type { WeekEvent } from "@/lib/types";

// POST /api/google/calendar
// Body: { weekOf: string; events: WeekEvent[] }
// Exports the week plan to the user's primary Google Calendar.
// Returns: { created, skipped, failed[], results[] }
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  let body: { weekOf?: string; events?: WeekEvent[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { weekOf, events } = body;

  if (!weekOf || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "weekOf and events are required" }, { status: 400 });
  }

  // Basic date format validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) {
    return NextResponse.json({ error: "weekOf must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const result = await exportWeekToCalendar(user.id, weekOf, events);
    // Use 207 Multi-Status when there are partial failures so the client can
    // distinguish "everything worked" (200) from "some events failed" (207).
    const status = result.failed.length > 0 ? 207 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Calendar export failed";
    const status = msg.includes("token") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
