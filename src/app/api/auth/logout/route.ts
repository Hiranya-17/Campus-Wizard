import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";

// POST /api/auth/logout
export async function POST() {
  await endSession();
  return NextResponse.json({ ok: true });
}
