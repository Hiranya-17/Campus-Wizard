import "server-only";
import { geminiGenerate } from "@/lib/agent/geminiFetch";
import type { Day, ExtractRequest, ExtractedEvent } from "@/lib/types";
import { DAYS } from "@/lib/types";


const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      date: { type: "string", nullable: true, description: "YYYY-MM-DD" },
      weekday: { type: "string", nullable: true, enum: DAYS },
      start: { type: "integer", nullable: true, description: "minutes after midnight" },
      end: { type: "integer", nullable: true, description: "minutes after midnight" },
      location: { type: "string", nullable: true },
      kind: { type: "string", enum: ["club", "exam", "deadline", "class"] },
    },
    required: ["title", "kind"],
  },
};

export async function extractWithGemini(req: ExtractRequest): Promise<ExtractedEvent[]> {
  const source = req.source ?? (req.kind === "email" ? "Email" : "Syllabus");
  const instructions =
    req.kind === "email"
      ? "Extract every event from this BU club email: meetings, socials, deadlines. Use weekday for recurring weekly meetings and date for one-time events."
      : "Extract every exam, quiz, project deadline and assignment due date from this course syllabus. Use the year of the current academic term.";
  const parts: unknown[] = [{ text: `${instructions}\nToday is ${new Date().toDateString()}. Times are minutes after midnight (7:30 pm = 1170).` }];
  if (req.text) parts.push({ text: req.text.slice(0, 60000) });
  if (req.pdfBase64) parts.push({ inlineData: { mimeType: "application/pdf", data: req.pdfBase64 } });

  const data = await geminiGenerate({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
  });
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? "[]";
  return (JSON.parse(raw) as Partial<ExtractedEvent>[]).map((e) => ({
    title: e.title ?? "Event",
    kind: e.kind ?? "club",
    date: e.date ?? null,
    weekday: e.weekday ?? null,
    start: e.start ?? null,
    end: e.end ?? null,
    location: e.location ?? null,
    source,
  }));
}

const WEEKDAYS: Record<string, Day> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toMin(h: string, m: string | undefined, ap: string | undefined): number {
  let hh = Number(h);
  if (ap?.toLowerCase().startsWith("p") && hh !== 12) hh += 12;
  if (ap?.toLowerCase().startsWith("a") && hh === 12) hh = 0;
  return hh * 60 + Number(m ?? 0);
}

/** No-key fallback: one event per line that mentions a weekday or a date plus a time. */
export function extractWithRules(req: ExtractRequest): ExtractedEvent[] {
  const source = req.source ?? (req.kind === "email" ? "Email" : "Syllabus");
  const year = new Date().getFullYear();
  const out: ExtractedEvent[] = [];
  for (const line of (req.text ?? "").split(/\n+/)) {
    const l = line.trim();
    if (!l) continue;
    const wd = l.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/);
    const md = l.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i) ?? null;
    const num = l.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    // "7-8:30pm", "7pm to 9pm", "6:30 pm"
    const range = l.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    const single = l.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!wd && !md && !num) continue;
    let date: string | null = null;
    if (md) date = `${year}-${String(MONTHS.indexOf(md[1].toLowerCase().slice(0, 3)) + 1).padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    else if (num) date = `${year}-${num[1].padStart(2, "0")}-${num[2].padStart(2, "0")}`;
    const start = range ? toMin(range[1], range[2], range[3] ?? range[6]) : single ? toMin(single[1], single[2], single[3]) : null;
    const end = range ? toMin(range[4], range[5], range[6]) : start != null ? start + 60 : null;
    const isExam = /exam|midterm|final|quiz/i.test(l);
    const isDue = /due|deadline/i.test(l);
    out.push({
      title: l.replace(/\s+/g, " ").slice(0, 80),
      date: wd && !date ? null : date,
      weekday: wd ? WEEKDAYS[wd[1]] : null,
      start, end,
      location: l.match(/\b(?:in|at|@)\s+([A-Z]{2,4}\s?\d{2,4}[A-Z]?|[A-Z][\w ]{2,30}(?:Hall|Center|Room|Library))/)?.[1] ?? null,
      kind: isExam ? "exam" : isDue ? "deadline" : req.kind === "email" ? "club" : "class",
      source,
    });
  }
  return out;
}
