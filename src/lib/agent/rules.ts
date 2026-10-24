import "server-only";
import { getFood } from "@/lib/data";
import { runTool } from "@/lib/agent/tools";
import type { ChatCard, ChatMessage, Profile } from "@/lib/types";

const CODE_RE = /\b(CAS|ENG|COM|CFA|CGS|SAR|SHA|SPH|QST|CDS|KHC|MET|SED|WED)?\s?([A-Z]{2})\s?(\d{3})\b/i;

/** Keyword fallback when no AI key is set, so the demo never breaks. */
export async function runRules(messages: ChatMessage[], profile: Profile): Promise<{ reply: string; cards: ChatCard[] }> {
  const text = messages.at(-1)?.content ?? "";
  const t = text.toLowerCase();

  const code = text.match(CODE_RE);
  if (code && /prereq|take|can i|about|what is|tell me/.test(t)) {
    const full = `${(code[1] ?? (code[2].toUpperCase() === "EK" || code[2].toUpperCase() === "EC" ? "ENG" : "CAS")).toUpperCase()} ${code[2].toUpperCase()} ${code[3]}`;
    const { result, card } = await runTool("get_course", { code: full }, profile);
    const r = result as { title?: string; error?: string; studentMeetsPrereqs?: boolean; missingPrereqs?: string[] };
    if (r.error) return { reply: r.error, cards: [] };
    const verdict = r.studentMeetsPrereqs ? "You meet the prerequisites." : `You still need: ${r.missingPrereqs!.join("; ")}.`;
    return { reply: `${full}: ${r.title}. ${verdict}`, cards: card ? [card] : [] };
  }

  if (/leave|get to|commute|late|bus|train|\bt\b|green line|walk/.test(t)) {
    const { result } = await runTool("route_day", {}, profile);
    const r = result as { day: string; message?: string; legs?: { to: string; toPlace: string; leaveBy: string; mode: string; walkMinutes: number; transit?: { board: string } }[] };
    if (r.message || !r.legs?.length) return { reply: r.message ?? "No classes that day.", cards: [] };
    const lines = r.legs.map((l) => `• Leave by ${l.leaveBy} for ${l.to} at ${l.toPlace} (${l.mode === "walk" ? `${l.walkMinutes} min walk` : `Green Line from ${l.transit?.board}`})`);
    return { reply: `${r.day}:\n${lines.join("\n")}`, cards: [] };
  }

  if (/semester|register|registration|next term|classes should|courses should|spring|fall/.test(t)) {
    const { result, card } = await runTool("plan_semester", {}, profile);
    const r = result as { courses: { code: string }[]; totalUnits: number; term: string };
    return {
      reply: `Here's a ${r.totalUnits}-unit plan for ${r.term}: ${r.courses.map((c) => c.code).join(", ")}. Tap a course to see sections.`,
      cards: card ? [card] : [],
    };
  }

  if (/week|schedule my|plan my|gym|study time|sleep/.test(t)) {
    const { result, card } = await runTool("plan_week", {}, profile);
    const r = result as { unscheduled: string[] };
    return {
      reply: `Here's your week. ${r.unscheduled.length ? `Couldn't fit: ${r.unscheduled.join(", ")}.` : "Everything fit."} Change your sleep, study or gym settings in Week settings.`,
      cards: card ? [card] : [],
    };
  }

  if (/food|eat|order|deliver|doordash|uber|grubhub|cheap|pizza|burger|hungry/.test(t)) {
    const names = [...new Set(getFood().map((q) => q.restaurant))];
    const match = names.find((n) => t.includes(n.toLowerCase().split(" ")[0]));
    const { card } = await runTool("compare_food", { restaurant: match }, profile);
    const data = card?.kind === "food" ? card.data : [];
    const top = data[0];
    return {
      reply: top
        ? `${top.restaurant}: ${top.cheapest} is cheapest for the same order, saving $${top.savings.toFixed(2)}.${data.length > 1 ? ` I compared ${data.length} restaurants.` : ""}`
        : "I don't have prices for that restaurant yet.",
      cards: card ? [card] : [],
    };
  }

  return {
    reply: "I'm Rhett. Try: \"Plan my spring semester\", \"Plan my week\", \"Can I take EC 413?\" or \"Cheapest way to order pizza\".",
    cards: [],
  };
}
