import { NextResponse } from "next/server";
import type { ChatRequest, ChatResponse } from "@/lib/types";

// POST /api/chat  ChatRequest -> ChatResponse
// TODO(A): connect the AI model with planner tools
export async function POST(req: Request) {
  const { messages } = (await req.json()) as ChatRequest;
  const last = messages.at(-1)?.content ?? "";
  const res: ChatResponse = { reply: `Rhett here. (Agent not connected yet.) You said: "${last}"` };
  return NextResponse.json(res);
}
