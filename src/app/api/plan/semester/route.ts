import { NextResponse } from "next/server";
import { getCourses, getMajor } from "@/lib/data";
import { planSemester } from "@/lib/planner/semester";
import type { SemesterPlanRequest } from "@/lib/types";

// POST /api/plan/semester  SemesterPlanRequest -> SemesterPlanResponse
export async function POST(req: Request) {
  const body = (await req.json()) as SemesterPlanRequest;
  const major = getMajor(body.majorId);
  if (!major) return NextResponse.json({ error: `unknown major ${body.majorId}` }, { status: 404 });
  return NextResponse.json(planSemester(body, major, getCourses()));
}
