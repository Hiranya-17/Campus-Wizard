import { NextResponse } from "next/server";
import { runGemini } from "@/lib/agent/gemini";
import { runRules } from "@/lib/agent/rules";
import { DEMO_PROFILE } from "@/lib/demo";
import type { ChatRequest, ChatResponse } from "@/lib/types";

// POST /api/chat  ChatRequest -> ChatResponse
export async function POST(req: Request) {
  const { messages, profile = DEMO_PROFILE } = (await req.json()) as ChatRequest;
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
