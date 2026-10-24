import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { storeKind } from "@/lib/store";

// GET /api/auth/me -> { user | null, store, secret }   (names which settings exist, never their values)
export async function GET() {
  const user = process.env.AUTH_SECRET ? await currentUser() : null;
  const storageVars = Object.keys(process.env).filter((k) => /REDIS|KV_|UPSTASH/.test(k));
  return NextResponse.json({ user, store: storeKind, secret: !!process.env.AUTH_SECRET, storageVars });
}
