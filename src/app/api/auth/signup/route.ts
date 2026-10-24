import { NextResponse } from "next/server";
import { accountsUnavailable, createUser, findUser, profileKey, startSession } from "@/lib/auth";
import { setJSON } from "@/lib/store";
import type { Profile } from "@/lib/types";

// POST /api/auth/signup { name, email, password, profile } -> { user }
export async function POST(req: Request) {
  const unavailable = accountsUnavailable();
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 503 });
  const { name, email, password, profile } = (await req.json()) as { name?: string; email?: string; password?: string; profile?: Profile };
  if (!name?.trim() || !email?.includes("@") || !password || password.length < 8) {
    return NextResponse.json({ error: "Enter your name, an email and a password of at least 8 characters." }, { status: 400 });
  }
  if (await findUser(email)) return NextResponse.json({ error: "There's already an account with that email. Log in instead." }, { status: 409 });
  const user = await createUser(email, name, password);
  if (profile) await setJSON(profileKey(user.id), { ...profile, name: user.name });
  await startSession(user);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
