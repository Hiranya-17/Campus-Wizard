import "server-only";
import { extractWithRules } from "@/lib/agent/extract";
import { geminiGenerate } from "@/lib/agent/geminiFetch";
import { kindOf } from "@/lib/study";
import type { Assignment, AssignmentKind, SyllabusRequest } from "@/lib/types";

const KINDS: AssignmentKind[] = ["exam", "quiz", "homework", "project", "paper"];

const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string", description: 'Short name, e.g. "Midterm 2", "HW 6", "Final project"' },
      kind: { type: "string", enum: KINDS },
      date: { type: "string", description: "YYYY-MM-DD" },
      time: { type: "integer", nullable: true, description: "minutes after midnight the exam starts or the work is due; null if not stated" },
      weight: { type: "number", nullable: true, description: "percent of the final grade for THIS item, if stated or derivable (e.g. 30% for 6 homeworks -> 5)" },
      topics: { type: "array", items: { type: "string" }, description: "chapters or topics it covers, short" },
    },
    required: ["title", "kind", "date"],
  },
};

const newId = (i: number) => `syl${Date.now().toString(36)}${i}`;

function clean(raw: Partial<Assignment>[], courseCode: string): Assignment[] {
  return raw
    .filter((r) => r.title && r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && KINDS.includes(r.kind as AssignmentKind))
    .map((r, i) => ({
      id: newId(i),
      courseCode,
      title: String(r.title).slice(0, 60),
      kind: r.kind as AssignmentKind,
      date: r.date!,
      time: typeof r.time === "number" && r.time >= 0 && r.time < 1440 ? r.time : null,
      weight: typeof r.weight === "number" && r.weight > 0 && r.weight <= 100 ? r.weight : null,
      topics: Array.isArray(r.topics) ? r.topics.slice(0, 8).map((t) => String(t).slice(0, 60)) : [],
      source: "syllabus" as const,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function readSyllabusGemini(req: SyllabusRequest): Promise<Assignment[]> {
  const parts: unknown[] = [{
    text: `This is the syllabus for ${req.courseCode} at Boston University. List every graded item with a date: exams (midterms, finals, tests), quizzes, homework/problem sets, projects and papers.
For repeating homework ("HW due every Friday"), list each one with its own date for the rest of the term.
Use the year of the current academic term. Today is ${new Date().toDateString()}. Times are minutes after midnight (2:00 pm = 840).`,
  }];
  if (req.text) parts.push({ text: req.text });
  if (req.pdfBase64) parts.push({ inlineData: { mimeType: "application/pdf", data: req.pdfBase64 } });
  const data = await geminiGenerate({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
  });
  return clean(JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? "[]"), req.courseCode);
}

/** No-AI fallback for pasted text: dated lines that mention an exam, quiz, homework, project or paper. */
export function readSyllabusRules(req: SyllabusRequest): Assignment[] {
  const lines = (req.text ?? "").split(/\n+/);
  const raw = extractWithRules({ kind: "syllabus", text: req.text })
    .filter((e) => e.date)
    .map((e) => {
      const line = lines.find((l) => l.trim().replace(/\s+/g, " ").startsWith(e.title.slice(0, 40))) ?? e.title;
      const kind = kindOf(line);
      const weight = line.match(/(\d{1,2}(?:\.\d)?)\s*%/)?.[1];
      // topics: after "covers" / "topics", else after the last ": " that isn't a clock time ("11:59 pm: Ch. 4 ...")
      const topicText = line.match(/\b(?:covers?|topics?)\b\s*:?\s*(.+)$/i)?.[1] ?? line.match(/(?<!\d):\s+([^:]+)$/)?.[1] ?? "";
      const topics = topicText.split(/,|;/).map((t) => t.trim()).filter((t) => t.length > 2);
      // title: the words before "due", "on", "in class", a comma or a colon ("HW 5 due Friday..." -> "HW 5")
      const title = line.trim().match(/^(.*?)(?=\s+(?:due|on|in class|at)\b|[:,(–]|\s+-\s|$)/i)?.[1]?.trim() ?? "";
      return { title: title || e.title, kind: kind ?? undefined, date: e.date!, time: e.start, weight: weight ? Number(weight) : null, topics };
    })
    .filter((r) => r.kind);
  return clean(raw as Partial<Assignment>[], req.courseCode);
}
