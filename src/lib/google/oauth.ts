import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getJSON, setJSON } from "@/lib/store";

// ---------------------------------------------------------------------------
// Environment variables (set these in .env.local)
// ---------------------------------------------------------------------------
// GOOGLE_CLIENT_ID       — OAuth 2.0 client ID from Google Cloud Console
// GOOGLE_CLIENT_SECRET   — OAuth 2.0 client secret from Google Cloud Console
// GOOGLE_REDIRECT_URI    — must match exactly what you registered, e.g.
//                          http://localhost:3000/api/google/callback  (dev)
//                          https://your-app.vercel.app/api/google/callback (prod)
// AUTH_SECRET            — already required by the existing email/password auth
// ---------------------------------------------------------------------------

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
// accept GOOGLE_REDIRECT_URL too: an easy typo to make in the Vercel dashboard
const REDIRECT_URI = (process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URL || "").trim();

/** True when all three Google env vars are present. */
export function googleConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

// ---------------------------------------------------------------------------
// PKCE / state helpers (anti-CSRF)
// ---------------------------------------------------------------------------

const STATE_COOKIE = "rhett_oauth_state";
const STATE_MAX_AGE = 60 * 10; // 10 minutes

export type OAuthFlow = "signin" | "connect";

/** Generate a state token (random + which flow it's for), persist it in a short-lived httpOnly cookie, return it. */
export async function createOAuthState(flow: OAuthFlow = "signin"): Promise<string> {
  const state = `${crypto.randomBytes(16).toString("base64url")}.${flow}`;
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });
  return state;
}

/** Validate the state param and clear the cookie. Returns the flow it was issued for, or null if invalid. */
export async function validateOAuthState(state: string): Promise<OAuthFlow | null> {
  const jar = await cookies();
  const stored = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!stored) return null;
  // Timing-safe compare
  if (stored.length !== state.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(state))) return null;
  return stored.endsWith(".connect") ? "connect" : "signin";
}

// ---------------------------------------------------------------------------
// OAuth URL builder
// ---------------------------------------------------------------------------

/**
 * Two separate permission requests:
 * - sign-in asks only for name and email (Google's basic scopes): no Google review is needed, so once the app is
 *   published anyone can use "Sign in with Google" without a warning screen;
 * - connect asks for Gmail (restricted) and Calendar (sensitive) only when the student taps "Connect Gmail &
 *   Calendar". Until Google verifies the app, that step works for the consent screen's test users.
 */
const SIGNIN_SCOPES = ["openid", "email", "profile"];
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const CONNECT_SCOPES = [...SIGNIN_SCOPES, GMAIL_SCOPE, CALENDAR_SCOPE];

export async function buildAuthUrl(flow: OAuthFlow = "signin"): Promise<string> {
  const state = await createOAuthState(flow);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: (flow === "connect" ? CONNECT_SCOPES : SIGNIN_SCOPES).join(" "),
    state,
    ...(flow === "connect"
      ? { access_type: "offline", prompt: "consent", include_granted_scopes: "true" } // refresh token for Gmail/Calendar
      : { prompt: "select_account" }),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Stored tokens include Gmail / Calendar access (i.e. the student went through "Connect"). */
export const hasScope = (tokens: GoogleTokens | null, scope: string) => Boolean(tokens?.scope?.split(" ").includes(scope));

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // Unix ms
  scope: string;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
    cache: "no-store",
  });
  const data = (await res.json()) as RawTokenResponse;
  if (!res.ok || data.error) {
    throw new Error(`Token exchange failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    cache: "no-store",
  });
  const data = (await res.json()) as RawTokenResponse;
  if (!res.ok || data.error) {
    throw new Error(`Token refresh failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: refreshToken, // refresh tokens are long-lived; keep the original
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

/** Revoke both tokens at Google and delete the stored copy. */
export async function revokeTokens(userId: string): Promise<void> {
  const tokens = await getGoogleTokens(userId);
  if (tokens) {
    const token = tokens.refreshToken ?? tokens.accessToken;
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      cache: "no-store",
    }).catch(() => {}); // best-effort
  }
  await setJSON(googleTokenKey(userId), null);
}

// ---------------------------------------------------------------------------
// Token storage (uses the same KV store as the rest of the app)
// ---------------------------------------------------------------------------

export const googleTokenKey = (userId: string) => `google_tokens:${userId}`;

export async function storeGoogleTokens(userId: string, tokens: GoogleTokens): Promise<void> {
  await setJSON(googleTokenKey(userId), tokens);
}

export async function getGoogleTokens(userId: string): Promise<GoogleTokens | null> {
  return getJSON<GoogleTokens>(googleTokenKey(userId));
}

/**
 * Return a valid access token, refreshing automatically if it expires within
 * 5 minutes. Returns null if no tokens are stored.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokens = await getGoogleTokens(userId);
  if (!tokens) return null;

  const fiveMin = 5 * 60 * 1000;
  if (tokens.expiresAt - Date.now() > fiveMin) return tokens.accessToken;

  if (!tokens.refreshToken) return null; // can't refresh
  try {
    const fresh = await refreshAccessToken(tokens.refreshToken);
    await storeGoogleTokens(userId, fresh);
    return fresh.accessToken;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Google user info
// ---------------------------------------------------------------------------

export interface GoogleUserInfo {
  sub: string;       // Google's stable user ID
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return res.json() as Promise<GoogleUserInfo>;
}
