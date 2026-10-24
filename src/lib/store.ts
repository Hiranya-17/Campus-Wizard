import "server-only";
import fs from "node:fs";
import path from "node:path";

import { createClient } from "redis";

/**
 * Tiny key-value store. Vercel's storage integrations name their env vars differently
 * (and sometimes add a prefix), so look for any of them:
 * - Upstash REST: *KV_REST_API_URL + *KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + _TOKEN
 * - Plain Redis: *REDIS_URL or *KV_URL (redis:// or rediss://)
 * Without either, a local JSON file in development.
 */
const envEnding = (suffix: string) => Object.entries(process.env).find(([k, v]) => k.endsWith(suffix) && v)?.[1];
const URL = process.env.UPSTASH_REDIS_REST_URL ?? envEnding("KV_REST_API_URL");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? envEnding("KV_REST_API_TOKEN");
const REDIS_URL = envEnding("REDIS_URL") ?? envEnding("KV_URL");
const FILE = path.join(process.cwd(), "data", ".local-db.json");

export const storeKind = URL && TOKEN ? "redis" : REDIS_URL ? "redis-tcp" : process.env.VERCEL ? "memory" : "file";
const memory = new Map<string, string>();

let tcp: ReturnType<typeof createClient> | null = null;
async function tcpClient() {
  if (!tcp) {
    tcp = createClient({ url: REDIS_URL });
    tcp.on("error", (e) => console.error("redis", e));
    await tcp.connect();
  }
  return tcp;
}

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
  else if (storeKind === "redis-tcp") raw = await (await tcpClient()).get(key);
  else if (storeKind === "memory") raw = memory.get(key);
  else raw = readFile()[key];
  return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  if (storeKind === "redis") await redis(["SET", key, raw]);
  else if (storeKind === "redis-tcp") await (await tcpClient()).set(key, raw);
  else if (storeKind === "memory") memory.set(key, raw);
  else fs.writeFileSync(FILE, JSON.stringify({ ...readFile(), [key]: raw }));
}
