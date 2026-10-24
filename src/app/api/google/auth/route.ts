import { NextResponse } from "next/server";
import { buildAuthUrl, googleConfigured } from "@/lib/google/oauth";
import { accountsUnavailable, currentUser } from "@/lib/auth";

// GET /api/google/auth
// Redirects the browser to Google's OAuth consent screen.
// GET /api/google/auth            -> sign in (name and email only)
// GET /api/google/auth?connect=1  -> connect Gmail & Calendar for the logged-in student
export async function GET(req: Request) {
  const unavailable = accountsUnavailable();
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 503 });

  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI." },
      { status: 503 },
    );
  }

  const connect = new URL(req.url).searchParams.get("connect") === "1";
  if (connect && !(await currentUser())) return NextResponse.redirect(new URL("/account?error=login_first", req.url));
  const url = await buildAuthUrl(connect ? "connect" : "signin");
  return NextResponse.redirect(url);
}
