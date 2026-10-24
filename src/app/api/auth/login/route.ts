import { NextResponse } from "next/server";
import { accountsUnavailable, checkPassword, findUser, startSession } from "@/lib/auth";
import { rateLimit, readJson } from "@/lib/guard";

// POST /api/auth/login { email, password } -> { user }
export async function POST(req: Request) {
  const unavailable = accountsUnavailable();
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 503 });
  const parsed = await readJson<{ email?: string; password?: string }>(req, 2_000);
  if ("error" in parsed) return parsed.error;
  const { email, password } = parsed.body;
  // Slow down password guessing: per IP, and per account from anywhere
  const limited =
    (await rateLimit(req, "login-ip", 10, 900)) ??
    (await rateLimit(new Request("http://x", { headers: { "x-forwarded-for": "any" } }), "login-email", 10, 900, String(email ?? "").toLowerCase()));
  if (limited) return limited;
  const user = email ? await findUser(email) : null;
  if (!user || !password || !checkPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }
  await startSession(user);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
