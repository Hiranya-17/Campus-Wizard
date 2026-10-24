import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CALENDAR_SCOPE, GMAIL_SCOPE, getGoogleTokens, hasScope } from "@/lib/google/oauth";

// GET /api/google/status -> { connected, gmail, calendar }
// connected = the student went through "Connect Gmail & Calendar" (signing in with Google alone doesn't count).
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ connected: false, gmail: false, calendar: false });
  const tokens = await getGoogleTokens(user.id);
  const gmail = hasScope(tokens, GMAIL_SCOPE);
  const calendar = hasScope(tokens, CALENDAR_SCOPE);
  return NextResponse.json({ connected: gmail || calendar, gmail, calendar });
}
