import { NextResponse } from "next/server";
import type { WeekPlanRequest } from "@/lib/types";
import { mockWeekPlan } from "@/mocks";

// POST /api/plan/week  WeekPlanRequest -> WeekPlanResponse
// TODO(A): replace mock with the real scheduler
export async function POST(req: Request) {
  const body = (await req.json()) as WeekPlanRequest;
  return NextResponse.json({ ...mockWeekPlan, weekOf: body.weekOf ?? mockWeekPlan.weekOf });
}
