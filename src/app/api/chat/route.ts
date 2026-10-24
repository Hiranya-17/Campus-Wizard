import { NextResponse } from "next/server";
import { runGemini } from "@/lib/agent/gemini";
import { runRules } from "@/lib/agent/rules";
import type { ChatRequest, ChatResponse, Profile } from "@/lib/types";

const DEMO_PROFILE: Profile = {
  name: "Demo student",
  majorId: "ce",
  standing: "sophomore",
  term: "Spring 2027",
  completed: [
    "CAS MA 123", "CAS CH 131", "ENG EK 100", "ENG EK 125", "CAS WR 120",
    "CAS MA 124", "CAS PY 211", "ENG EK 131", "ENG EK 103", "CAS WR 150",
    "CAS MA 225", "CAS PY 212", "ENG EK 307", "ENG EC 327", "CAS MA 193",
  ],
};

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
  return NextResponse.json({ ...runRules(messages, profile), engine: "rules" } satisfies ChatResponse);
}
