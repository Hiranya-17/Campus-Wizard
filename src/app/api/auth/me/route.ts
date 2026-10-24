import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google/oauth";

// GET /api/auth/me -> { user | null, googleAvailable }
export async function GET() {
  const user = process.env.AUTH_SECRET ? await currentUser() : null;
  return NextResponse.json({ user, googleAvailable: googleConfigured() });
}
