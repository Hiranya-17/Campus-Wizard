import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getGoogleTokens } from "@/lib/google/oauth";

// GET /api/google/status -> { connected: boolean }
// Tells the client whether the current user has Google tokens stored.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ connected: false });
  const tokens = await getGoogleTokens(user.id);
  return NextResponse.json({ connected: Boolean(tokens) });
}
