import { NextResponse } from "next/server";
import {
  exchangeCode,
  fetchGoogleUserInfo,
  storeGoogleTokens,
  validateOAuthState,
} from "@/lib/google/oauth";
import { upsertGoogleUser, startSession, profileKey } from "@/lib/auth";
import { getJSON, setJSON } from "@/lib/store";
import { starterProfile } from "@/lib/demo";
import type { Profile } from "@/lib/types";

// GET /api/google/callback?code=...&state=...
// Google redirects here after the user grants (or denies) consent.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access
  if (error) {
    return NextResponse.redirect(new URL("/account?error=google_denied", req.url));
  }

  // Validate CSRF state
  if (!state || !code || !(await validateOAuthState(state))) {
    return NextResponse.redirect(new URL("/account?error=invalid_state", req.url));
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Get user info from Google
    const googleUser = await fetchGoogleUserInfo(tokens.accessToken);
    if (!googleUser.email_verified) {
      return NextResponse.redirect(new URL("/account?error=email_not_verified", req.url));
    }

    // Upsert our app user (creates or merges with existing email/password account)
    const user = await upsertGoogleUser(googleUser.sub, googleUser.email, googleUser.name);

    // Store tokens so Gmail / Calendar routes can use them
    await storeGoogleTokens(user.id, tokens);

    // Create a starter profile if one doesn't exist yet
    const existingProfile = await getJSON<Profile>(profileKey(user.id));
    if (!existingProfile) {
      await setJSON(profileKey(user.id), starterProfile({ name: user.name, majorId: "ce", standing: "freshman", home: "WARREN" }));
    }

    // Set the session cookie (same mechanism as email/password login)
    await startSession(user);

    // New accounts finish setup first (major, year, courses taken); returning users go home
    return NextResponse.redirect(new URL(existingProfile ? "/" : "/account?setup=1", req.url));
  } catch (err) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(new URL("/account?error=google_failed", req.url));
  }
}
