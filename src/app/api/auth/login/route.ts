import { NextResponse } from "next/server";
import { accountsUnavailable, checkPassword, findUser, startSession } from "@/lib/auth";

// POST /api/auth/login { email, password } -> { user }
export async function POST(req: Request) {
  const unavailable = accountsUnavailable();
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 503 });
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const user = email ? await findUser(email) : null;
  if (!user || !password || !checkPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }
  await startSession(user);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
