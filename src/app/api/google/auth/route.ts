import { NextResponse } from "next/server";
import { buildAuthUrl, googleConfigured } from "@/lib/google/oauth";
import { accountsUnavailable } from "@/lib/auth";

// GET /api/google/auth
// Redirects the browser to Google's OAuth consent screen.
export async function GET() {
  const unavailable = accountsUnavailable();
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 503 });

  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI." },
      { status: 503 },
    );
  }

  const url = await buildAuthUrl();
  return NextResponse.redirect(url);
}
