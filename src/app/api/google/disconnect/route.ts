import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { revokeTokens } from "@/lib/google/oauth";

// POST /api/google/disconnect
// Revoke Google tokens and remove them from the store. The CampusWizard account is kept.
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  await revokeTokens(user.id);
  return NextResponse.json({ ok: true });
}
