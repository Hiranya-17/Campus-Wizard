import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

// GET /api/auth/me -> { user | null }
export async function GET() {
  const user = process.env.AUTH_SECRET ? await currentUser() : null;
  return NextResponse.json({ user });
}
