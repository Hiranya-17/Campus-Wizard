import { NextResponse } from "next/server";
import {
  exchangeCode,
  fetchGoogleUserInfo,
  getGoogleTokens,
  saveMailbox,
  storeGoogleTokens,
  validateOAuthState,
} from "@/lib/google/oauth";
import { currentUser, upsertGoogleUser, startSession, profileKey } from "@/lib/auth";
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

  // Validate CSRF state (it also says which flow this was: sign-in or connect Gmail & Calendar)
  const flow = state && code ? await validateOAuthState(state) : null;
  if (!flow || !code) {
    return NextResponse.redirect(new URL("/account?error=invalid_state", req.url));
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Connect flow: attach Gmail/Calendar access to the student who is already logged in
    if (flow === "connect") {
      const me = await currentUser();
      if (!me) return NextResponse.redirect(new URL("/account?error=login_first", req.url));
      const previous = await getGoogleTokens(me.id);
      const email = await fetchGoogleUserInfo(tokens.accessToken).then((u) => u.email, () => previous?.email);
      await storeGoogleTokens(me.id, { ...tokens, email, refreshToken: tokens.refreshToken ?? previous?.refreshToken ?? null });
      return NextResponse.redirect(new URL("/account?google=connected", req.url));
    }

    // Another inbox: read-only Gmail for a second (third…) Google account, added to the logged-in student
    if (flow === "mailbox") {
      const me = await currentUser();
      if (!me) return NextResponse.redirect(new URL("/account?error=login_first", req.url));
      const { email } = await fetchGoogleUserInfo(tokens.accessToken);
      const primary = await getGoogleTokens(me.id);
      if (primary?.email === email) return NextResponse.redirect(new URL("/money?inbox=already", req.url));
      const saved = await saveMailbox(me.id, email, { ...tokens, email });
      return NextResponse.redirect(new URL(saved ? `/money?inbox=added` : "/money?inbox=full", req.url));
    }

    // Get user info from Google
    const googleUser = await fetchGoogleUserInfo(tokens.accessToken);
    if (!googleUser.email_verified) {
      return NextResponse.redirect(new URL("/account?error=email_not_verified", req.url));
    }

    // Upsert our app user (creates or merges with existing email/password account)
    const user = await upsertGoogleUser(googleUser.sub, googleUser.email, googleUser.name);

    // Sign-in only grants name and email, so there is nothing to store for Gmail/Calendar here;
    // any earlier "Connect Gmail & Calendar" tokens for this account are left as they are.

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
