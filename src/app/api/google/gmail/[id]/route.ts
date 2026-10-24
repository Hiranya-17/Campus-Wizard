import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getMessage } from "@/lib/google/gmail";

// GET /api/google/gmail/:id
// Returns the full plain-text body of a single message.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const message = await getMessage(user.id, id);
    return NextResponse.json({ message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail fetch failed";
    const status = msg.includes("token") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
