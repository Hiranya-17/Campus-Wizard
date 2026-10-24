import { NextResponse } from "next/server";
import { currentUser, profileKey } from "@/lib/auth";
import { rateLimit, readJson } from "@/lib/guard";
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
  const limited = await rateLimit(req, "profile", 120, 600, user.id);
  if (limited) return limited;
  const parsed = await readJson<Profile>(req, 400_000);
  if ("error" in parsed) return parsed.error;
  const profile = parsed.body;
  // Must look like a profile; anything else is refused instead of stored
  if (!profile || typeof profile !== "object" || Array.isArray(profile) || typeof profile.majorId !== "string" || !Array.isArray(profile.completed)) {
    return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  }
  await setJSON(profileKey(user.id), profile);
  return NextResponse.json({ ok: true });
}
