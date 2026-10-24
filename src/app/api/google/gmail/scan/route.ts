import { NextResponse } from "next/server";
import { scanInboxForEvents } from "@/lib/agent/gmailScan";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/guard";

// POST /api/google/gmail/scan -> { scanned, events, engine }
// Searches the logged-in student's Gmail (last 30 days, club/event emails) and returns the meetings found.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const limited = await rateLimit(req, "gmail-scan", 20, 600, user.id);
  if (limited) return limited;
  try {
    return NextResponse.json(await scanInboxForEvents(user.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail scan failed";
    return NextResponse.json({ error: msg.includes("token") ? "Reconnect Gmail on the Account page." : "Couldn't read your Gmail right now." }, { status: msg.includes("token") ? 401 : 502 });
  }
}
