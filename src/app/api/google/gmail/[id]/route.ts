import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getMessage } from "@/lib/google/gmail";

// GET /api/google/gmail/:id?account=...
// Returns the full plain-text body of a single message from the given inbox ("primary" by default).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { id } = await params;
  // Gmail ids are short hex/base64url strings; anything else could steer the request to another Gmail API path
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const account = (new URL(req.url).searchParams.get("account") ?? "primary").slice(0, 254);
    const message = await getMessage(user.id, id, account);
    return NextResponse.json({ message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail fetch failed";
    const status = msg.includes("token") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
