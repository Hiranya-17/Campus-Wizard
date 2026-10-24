import { NextResponse } from "next/server";
import { extractWithGemini, extractWithRules } from "@/lib/agent/extract";
import { rateLimit, readJson } from "@/lib/guard";
import type { ExtractRequest, ExtractResponse } from "@/lib/types";

// POST /api/extract-events  ExtractRequest -> ExtractResponse
// Club emails (from Gmail) and syllabi (text or PDF) -> dated events, exams, deadlines.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "extract", 150, 600);
  if (limited) return limited;
  const parsed = await readJson<ExtractRequest>(req, 4_000_000); // Vercel rejects bodies over 4.5 MB anyway
  if ("error" in parsed) return parsed.error;
  const body = { ...parsed.body, text: parsed.body.text?.slice(0, 30_000) };
  if (process.env.GEMINI_API_KEY) {
    try {
      return NextResponse.json({ events: await extractWithGemini(body), engine: "gemini" } satisfies ExtractResponse);
    } catch (e) {
      console.error(e);
    }
  }
  return NextResponse.json({ events: extractWithRules(body), engine: "rules" } satisfies ExtractResponse);
}
