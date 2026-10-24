import { NextResponse } from "next/server";
import { currentUser, profileKey } from "@/lib/auth";
import { getJSON, setJSON } from "@/lib/store";
import type { Profile } from "@/lib/types";

// GET /api/profile -> Profile | null   PUT /api/profile Profile -> { ok }   (logged-in users only)
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  return NextResponse.json(await getJSON<Profile>(profileKey(user.id)));
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const profile = (await req.json()) as Profile;
  await setJSON(profileKey(user.id), profile);
  return NextResponse.json({ ok: true });
}
