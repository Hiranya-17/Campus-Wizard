import { NextResponse } from "next/server";
import { getDining } from "@/lib/data";
import { hallsToday } from "@/lib/dining";
import { recommendDiningGemini, recommendDiningRules } from "@/lib/agent/dining";
import { rateLimit, readJson } from "@/lib/guard";
import type { DiningRecommendRequest } from "@/lib/types";

// POST /api/dining/recommend  DiningRecommendRequest -> { recommendations, engine }
// Suggests dining halls and dishes for the cuisine the student wants today.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "dining", 30, 600);
  if (limited) return limited;
  const parsed = await readJson<DiningRecommendRequest>(req, 4_000);
  if ("error" in parsed) return parsed.error;
  const body: DiningRecommendRequest = {
    cuisine: String(parsed.body.cuisine ?? "").slice(0, 100),
    meal: parsed.body.meal,
    tags: Array.isArray(parsed.body.tags) ? parsed.body.tags.slice(0, 5).map((t) => String(t).slice(0, 20)) : undefined,
  };
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
