import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getJSON, setJSON, storeKind } from "@/lib/store";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // "salt:hash", scrypt
  createdAt: string;
}
export type PublicUser = Pick<User, "id" | "email" | "name">;

const COOKIE = "rhett_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/** Accounts need a session secret, and on Vercel a real database (memory resets between requests). */
export function accountsUnavailable(): string | null {
  if (!process.env.AUTH_SECRET || storeKind === "memory") return "Accounts aren't set up on this server yet. You can keep using Rhett as a guest.";
  return null;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export const userKey = (email: string) => `user:${email.trim().toLowerCase()}`;
export const profileKey = (userId: string) => `profile:${userId}`;

export async function findUser(email: string) {
  return getJSON<User>(userKey(email));
}

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const user: User = {
    id: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await setJSON(userKey(user.email), user);
  return user;
}

/** Set a signed session cookie: base64url({id,email,name,exp}).signature */
export async function startSession(user: User) {
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, email: user.email, name: user.name, exp: Date.now() + MAX_AGE * 1000 }),
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<PublicUser | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (data.exp < Date.now()) return null;
  return { id: data.id, email: data.email, name: data.name };
}
