import { NextResponse } from "next/server";
import { accountsUnavailable, createUser, findUser, profileKey, startSession } from "@/lib/auth";
import { rateLimit, readJson } from "@/lib/guard";
import { setJSON } from "@/lib/store";
import type { Profile } from "@/lib/types";

// POST /api/auth/signup { name, email, password, profile } -> { user }
export async function POST(req: Request) {
  const unavailable = accountsUnavailable();
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 503 });
  const limited = await rateLimit(req, "signup", 5, 3600);
  if (limited) return limited;
  const parsed = await readJson<{ name?: string; email?: string; password?: string; profile?: Profile }>(req, 400_000);
  if ("error" in parsed) return parsed.error;
  const { name, email, password, profile } = parsed.body;
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || name.length > 80 || email.length > 120 || password.length > 200) {
    return NextResponse.json({ error: "Check your name, email and password." }, { status: 400 });
  }
  if (!name?.trim() || !email?.includes("@") || !password || password.length < 8) {
    return NextResponse.json({ error: "Enter your name, an email and a password of at least 8 characters." }, { status: 400 });
  }
  if (await findUser(email)) return NextResponse.json({ error: "There's already an account with that email. Log in instead." }, { status: 409 });
  const user = await createUser(email, name, password);
  if (profile && typeof profile === "object") await setJSON(profileKey(user.id), { ...profile, name: user.name });
  await startSession(user);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
