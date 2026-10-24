import { assignmentsToIcs } from "@/lib/ics";
import { readJson } from "@/lib/guard";
import type { Assignment } from "@/lib/types";

// POST /api/assignments.ics  { assignments: Assignment[] } -> .ics with reminders (Google/Apple Calendar import)
export async function POST(req: Request) {
  const parsed = await readJson<{ assignments?: Assignment[] }>(req, 300_000);
  if ("error" in parsed) return parsed.error;
  const items = (Array.isArray(parsed.body.assignments) ? parsed.body.assignments : [])
    .filter((a) => a && typeof a.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && typeof a.title === "string")
    .slice(0, 300);
  return new Response(assignmentsToIcs(items), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="rhett-exams-and-homework.ics"' },
  });
}
