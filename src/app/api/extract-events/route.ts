import { NextResponse } from "next/server";
import { extractWithGemini, extractWithRules } from "@/lib/agent/extract";
import type { ExtractRequest, ExtractResponse } from "@/lib/types";

// POST /api/extract-events  ExtractRequest -> ExtractResponse
// Club emails (from Gmail) and syllabi (text or PDF) -> dated events, exams, deadlines.
export async function POST(req: Request) {
  const body = (await req.json()) as ExtractRequest;
  if (process.env.GEMINI_API_KEY) {
    try {
      return NextResponse.json({ events: await extractWithGemini(body), engine: "gemini" } satisfies ExtractResponse);
    } catch (e) {
      console.error(e);
    }
  }
  return NextResponse.json({ events: extractWithRules(body), engine: "rules" } satisfies ExtractResponse);
}
