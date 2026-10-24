import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listMessages } from "@/lib/google/gmail";

// GET /api/google/gmail?q=...&max=30
// Returns a list of recent email summaries for the logged-in user.
// Requires Google tokens (user must have signed in with Google or connected Gmail).
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "in:inbox newer_than:30d";
  const max = Math.min(50, Math.max(1, Number(searchParams.get("max") ?? "30")));

  try {
    const messages = await listMessages(user.id, q, max);
    return NextResponse.json({ messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail fetch failed";
    const status = msg.includes("token") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
