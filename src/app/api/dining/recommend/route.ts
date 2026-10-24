import { NextResponse } from "next/server";
import { getDining } from "@/lib/data";
import { hallsToday } from "@/lib/dining";
import { recommendDiningGemini, recommendDiningRules } from "@/lib/agent/dining";
import type { DiningRecommendRequest } from "@/lib/types";

// POST /api/dining/recommend  DiningRecommendRequest -> { recommendations, engine }
// Suggests dining halls and dishes for the cuisine the student wants today.
export async function POST(req: Request) {
  const body = (await req.json()) as DiningRecommendRequest;
  const halls = hallsToday(getDining());
  if (process.env.GEMINI_API_KEY) {
    try {
      const recommendations = await recommendDiningGemini(body, halls);
      if (recommendations.length) return NextResponse.json({ recommendations, engine: "gemini" });
    } catch (e) {
      console.error(e);
    }
  }
  return NextResponse.json({ recommendations: recommendDiningRules(body, halls), engine: "rules" });
}
