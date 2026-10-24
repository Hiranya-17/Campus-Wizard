import { NextResponse } from "next/server";
import type { SemesterPlanRequest } from "@/lib/types";
import { mockSemesterPlan } from "@/mocks";

// POST /api/plan/semester  SemesterPlanRequest -> SemesterPlanResponse
// TODO(A): replace mock with the real planner
export async function POST(req: Request) {
  const body = (await req.json()) as SemesterPlanRequest;
  return NextResponse.json({ ...mockSemesterPlan, term: body.term ?? mockSemesterPlan.term });
}
