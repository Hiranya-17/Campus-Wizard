import "server-only";
import { NextResponse } from "next/server";
import { incr } from "@/lib/store";

/** Caller's IP as Vercel reports it (first hop of x-forwarded-for). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/**
 * Per-IP rate limit. Returns a 429 response when over the limit, otherwise null.
 * Limits are generous because a whole campus network (BU Wi-Fi, the hackathon venue) can share one IP;
 * they stop scripts running up the Gemini bill, not normal use. Login also has a strict per-account limit.
 * Protects the endpoints that spend money on the Gemini key and the login form.
 * If the counter store is unreachable, let the request through rather than break the app.
 */
export async function rateLimit(req: Request, bucket: string, limit: number, windowSeconds: number, extraKey = "") {
  try {
    const n = await incr(`rl:${bucket}:${clientIp(req)}${extraKey ? `:${extraKey}` : ""}`, windowSeconds);
    if (n > limit) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(windowSeconds) } },
      );
    }
  } catch (e) {
    console.error("rate limit store unavailable", e);
  }
  return null;
}

/** Read a JSON body, refusing anything over `maxBytes` (413) or not valid JSON (400). */
export async function readJson<T>(req: Request, maxBytes: number): Promise<{ body: T } | { error: NextResponse }> {
  const text = await req.text();
  if (text.length > maxBytes) {
    return { error: NextResponse.json({ error: "Request too large." }, { status: 413 }) };
  }
  try {
    return { body: JSON.parse(text) as T };
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON." }, { status: 400 }) };
  }
}
