import { NextResponse } from "next/server";
import { runGemini } from "@/lib/agent/gemini";
import { runRules } from "@/lib/agent/rules";
import { DEMO_PROFILE } from "@/lib/demo";
import { rateLimit, readJson } from "@/lib/guard";
import type { ChatRequest, ChatResponse } from "@/lib/types";

// POST /api/chat  ChatRequest -> ChatResponse
export async function POST(req: Request) {
  const limited = await rateLimit(req, "chat", 400, 600);
  if (limited) return limited;
  const parsed = await readJson<ChatRequest>(req, 400_000);
  if ("error" in parsed) return parsed.error;
  const { profile = DEMO_PROFILE } = parsed.body;
  // Only the recent conversation, each message capped, so one request can't run up the AI bill
  const messages = (Array.isArray(parsed.body.messages) ? parsed.body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length) return NextResponse.json({ error: "No message." }, { status: 400 });
  if (process.env.GEMINI_API_KEY) {
    try {
      const out = await runGemini(messages, profile);
      return NextResponse.json({ ...out, engine: "gemini" } satisfies ChatResponse);
    } catch (e) {
      console.error(e);
    }
  }
  return NextResponse.json({ ...(await runRules(messages, profile)), engine: "rules" } satisfies ChatResponse);
}
