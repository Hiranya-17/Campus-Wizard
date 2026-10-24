import { NextResponse } from "next/server";
import { planWeek } from "@/lib/planner/week";
import type { WeekPlanRequest } from "@/lib/types";

// POST /api/plan/week  WeekPlanRequest -> WeekPlanResponse
export async function POST(req: Request) {
  const body = (await req.json()) as WeekPlanRequest;
  return NextResponse.json(planWeek(body));
}
