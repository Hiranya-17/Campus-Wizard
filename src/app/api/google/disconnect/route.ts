import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { readJson } from "@/lib/guard";
import { removeMailbox, revokeTokens } from "@/lib/google/oauth";

// POST /api/google/disconnect               -> revoke the main Gmail & Calendar connection
// POST /api/google/disconnect {inbox: email} -> remove one extra inbox
// Tokens are revoked at Google and deleted here. The CampusWizard account is kept.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const parsed = await readJson<{ inbox?: unknown }>(req, 1_000); // an empty body means the main connection
  const inbox = "body" in parsed && typeof parsed.body?.inbox === "string" ? parsed.body.inbox : null;
  if (inbox) await removeMailbox(user.id, inbox);
  else await revokeTokens(user.id);
  return NextResponse.json({ ok: true });
}
