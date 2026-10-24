import { planWeek } from "@/lib/planner/week";
import { toIcs } from "@/lib/ics";
import type { WeekPlanRequest } from "@/lib/types";

// POST /api/week.ics  WeekPlanRequest -> .ics file (import into Google/Apple Calendar)
export async function POST(req: Request) {
  const body = (await req.json()) as WeekPlanRequest;
  const plan = planWeek(body);
  return new Response(toIcs(plan.weekOf, plan.events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rhett-week-${plan.weekOf}.ics"`,
    },
  });
}
