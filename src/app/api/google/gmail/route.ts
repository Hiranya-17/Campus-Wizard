import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listAllMessages, listMessages } from "@/lib/google/gmail";
import { rateLimit } from "@/lib/guard";

// GET /api/google/gmail?q=...&max=30&account=all
// Returns recent email summaries for the logged-in user. account=all searches every linked inbox
// (each message says which one it came from); otherwise "primary" (the default) or one inbox's address.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const limited = await rateLimit(req, "gmail-list", 60, 600, user.id);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "in:inbox newer_than:30d").slice(0, 500);
  const max = Math.min(50, Math.max(1, Number(searchParams.get("max") ?? "30")));
  const account = (searchParams.get("account") ?? "primary").slice(0, 254);

  try {
    if (account === "all") return NextResponse.json(await listAllMessages(user.id, q, max));
    const messages = await listMessages(user.id, q, max, account);
    return NextResponse.json({ messages, failed: [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail fetch failed";
    const status = msg.includes("token") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
