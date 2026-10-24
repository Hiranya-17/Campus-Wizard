import "server-only";
import { geminiGenerate } from "@/lib/agent/geminiFetch";
import { matchesCuisine } from "@/lib/dining";
import type { DiningHallToday, DiningRecommendation, DiningRecommendRequest } from "@/lib/types";

const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      hallId: { type: "string", description: "id of the dining hall, exactly as given" },
      items: { type: "array", items: { type: "string" }, description: "1-3 dishes to try there today, from the menu given" },
      why: { type: "string", description: "one short sentence on why it fits what they want" },
    },
    required: ["hallId", "items", "why"],
  },
};

/** Keep only today's items that match the requested meal and dietary tags. */
function eligibleItems(halls: DiningHallToday[], req: DiningRecommendRequest): DiningHallToday[] {
  const tags = (req.tags ?? []).map((t) => t.toLowerCase());
  return halls.map((h) => ({
    ...h,
    items: h.items.filter((it) => {
      if (req.meal && !it.meals.includes(req.meal)) return false;
      if (tags.length && !tags.every((t) => it.tags.map((x) => x.toLowerCase()).includes(t))) return false;
      return true;
    }),
  }));
}

export async function recommendDiningGemini(req: DiningRecommendRequest, halls: DiningHallToday[]): Promise<DiningRecommendation[]> {
  const pool = eligibleItems(halls, req).filter((h) => h.items.length > 0);
  if (!pool.length) return [];
  const menuText = pool
    .map((h) => `${h.hall.name} (id: ${h.hall.id}, ${h.openNow ? "open now" : "closed now"}): ${h.items.map((i) => `${i.name} [${i.cuisine}, ${i.station}${i.tags.length ? ", " + i.tags.join("/") : ""}]`).join("; ")}`)
    .join("\n");
  const data = await geminiGenerate({
    contents: [{
      role: "user",
      parts: [{
        text: `A Boston University student wants ${req.cuisine || "something good"}${req.meal ? ` for ${req.meal}` : ""}${req.tags?.length ? ` (dietary: ${req.tags.join(", ")})` : ""} today.
Recommend 1-3 dining halls from the list below and name specific dishes from THAT hall's menu only. Prefer halls open now. Keep "why" to one sentence.
Dining halls and today's menus:
${menuText}`,
      }],
    }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
  });
  const raw: { hallId?: string; items?: string[]; why?: string }[] = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? "[]");
  return raw
    .map((r) => {
      const hall = pool.find((h) => h.hall.id === r.hallId);
      if (!hall) return null;
      return { hallId: hall.hall.id, hallName: hall.hall.name, items: (r.items ?? []).slice(0, 3), why: r.why ?? "" };
    })
    .filter((r): r is DiningRecommendation => r != null && r.items.length > 0);
}

/** No-key fallback: score each hall by how many of today's items match the query. */
export function recommendDiningRules(req: DiningRecommendRequest, halls: DiningHallToday[]): DiningRecommendation[] {
  const pool = eligibleItems(halls, req);
  return pool
    .map((h) => {
      const hits = h.items.filter((it) => matchesCuisine(it, req.cuisine));
      const items = (hits.length ? hits : h.items).slice(0, 3);
      return {
        hallId: h.hall.id,
        hallName: h.hall.name,
        items: items.map((i) => i.name),
        why: hits.length
          ? `${hits.length} ${req.cuisine || "matching"} option${hits.length > 1 ? "s" : ""} today${h.openNow ? ", open now" : ""}.`
          : `On today's menu${h.openNow ? ", open now" : ""}.`,
        score: hits.length + (h.openNow ? 0.5 : 0),
      };
    })
    .filter((r) => r.items.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ hallId, hallName, items, why }) => ({ hallId, hallName, items, why }));
}
