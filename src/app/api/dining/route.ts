import { NextResponse } from "next/server";
import { getDining } from "@/lib/data";
import { hallsToday } from "@/lib/dining";

// GET /api/dining -> DiningHallToday[] (each hall with today's hours, open-now status and menu)
export async function GET() {
  return NextResponse.json(hallsToday(getDining()));
}
