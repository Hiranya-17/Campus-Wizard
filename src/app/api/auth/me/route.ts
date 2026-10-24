import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { storeKind } from "@/lib/store";

// GET /api/auth/me -> { user | null, store }
export async function GET() {
  return NextResponse.json({ user: await currentUser(), store: storeKind });
}
