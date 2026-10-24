import { NextResponse } from "next/server";
import { readSyllabusGemini, readSyllabusRules } from "@/lib/agent/syllabus";
import { rateLimit, readJson } from "@/lib/guard";
import type { SyllabusRequest, SyllabusResponse } from "@/lib/types";

// POST /api/syllabus  SyllabusRequest (text or PDF) -> SyllabusResponse: exams, quizzes, homework, projects, papers
export async function POST(req: Request) {
  const limited = await rateLimit(req, "syllabus", 150, 600);
  if (limited) return limited;
  const parsed = await readJson<SyllabusRequest>(req, 4_000_000); // Vercel rejects bodies over 4.5 MB anyway
  if ("error" in parsed) return parsed.error;
  const body: SyllabusRequest = {
    courseCode: String(parsed.body.courseCode ?? "").slice(0, 20) || "Course",
    text: parsed.body.text?.slice(0, 40_000),
    pdfBase64: typeof parsed.body.pdfBase64 === "string" ? parsed.body.pdfBase64 : undefined,
  };
  if (!body.text?.trim() && !body.pdfBase64) return NextResponse.json({ error: "Upload a PDF or paste the syllabus text." }, { status: 400 });
  if (process.env.GEMINI_API_KEY) {
    try {
      const items = await readSyllabusGemini(body);
      return NextResponse.json({ courseCode: body.courseCode, items, engine: "gemini" } satisfies SyllabusResponse);
    } catch (e) {
      console.error(e);
    }
  }
  const items = readSyllabusRules(body);
  return NextResponse.json({
    courseCode: body.courseCode, items, engine: "rules",
    note: body.pdfBase64 && !body.text ? "Reading PDFs needs the AI, which isn't available right now. Paste the syllabus text instead." : undefined,
  } satisfies SyllabusResponse);
}
