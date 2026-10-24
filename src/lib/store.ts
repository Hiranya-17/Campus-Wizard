import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Tiny key-value store. Uses Upstash Redis over REST when its env vars are set
 * (Vercel adds them when you connect Upstash), otherwise a local JSON file for development.
 */
const URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const FILE = path.join(process.cwd(), "data", ".local-db.json");

export const storeKind = URL && TOKEN ? "redis" : process.env.VERCEL ? "memory" : "file";
const memory = new Map<string, string>();

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}: ${await res.text()}`);
  return (await res.json()).result;
}

function readFile(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function getJSON<T>(key: string): Promise<T | null> {
  let raw: unknown;
  if (storeKind === "redis") raw = await redis(["GET", key]);
  else if (storeKind === "memory") raw = memory.get(key);
  else raw = readFile()[key];
  return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  if (storeKind === "redis") await redis(["SET", key, raw]);
  else if (storeKind === "memory") memory.set(key, raw);
  else fs.writeFileSync(FILE, JSON.stringify({ ...readFile(), [key]: raw }));
}
