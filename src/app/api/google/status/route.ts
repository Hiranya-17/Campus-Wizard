import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listInboxes } from "@/lib/google/gmail";
import { CALENDAR_SCOPE, GMAIL_SCOPE, getGoogleTokens, hasScope } from "@/lib/google/oauth";

// GET /api/google/status -> { connected, gmail, calendar, email, inboxes }
// connected = the student went through "Connect Gmail & Calendar" (signing in with Google alone doesn't count).
// inboxes = every inbox with Gmail access: that main connection plus any extra addresses they added.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ connected: false, gmail: false, calendar: false, email: null, inboxes: [] });
  const [tokens, inboxes] = await Promise.all([getGoogleTokens(user.id), listInboxes(user.id)]);
  const gmail = hasScope(tokens, GMAIL_SCOPE);
  const calendar = hasScope(tokens, CALENDAR_SCOPE);
  return NextResponse.json({ connected: gmail || calendar, gmail, calendar, email: tokens?.email ?? null, inboxes });
}
