import { NextResponse } from "next/server";
import { getCourses } from "@/lib/data";

// GET /api/courses?q=wr 153   ?code=ENG EC 311   ?codes=CAS MA 123,ENG EK 125   (&term=Fall 2026 adds section counts)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const courses = getCourses();
  const term = searchParams.get("term");
  const codes = searchParams.get("codes");
  if (codes) {
    return NextResponse.json(
      codes.split(",").map((c) => courses.get(c.trim().toUpperCase())).filter(Boolean).map((c) => ({ code: c!.code, title: c!.title, units: c!.units })),
    );
  }
  const code = searchParams.get("code");
  if (code) {
    const c = courses.get(code.toUpperCase());
    return c ? NextResponse.json(c) : NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();
  if (!q) return NextResponse.json([]);
  // "wr153", "WR 153" and "cas wr 153" all match CAS WR 153; codes rank above title matches
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const sq = squash(q);
  const scored: { score: number; c: (typeof courses extends Map<string, infer V> ? V : never) }[] = [];
  for (const c of courses.values()) {
    const code = squash(c.code);
    const score = code.endsWith(sq) ? 0 : code.includes(sq) ? 1 : c.title.toLowerCase().includes(q) ? 2 : -1;
    if (score >= 0) scored.push({ score, c });
  }
  scored.sort((a, b) => a.score - b.score || a.c.code.localeCompare(b.c.code));
  return NextResponse.json(
    scored.slice(0, 25).map(({ c }) => ({
      code: c.code, title: c.title, units: c.units, hub: c.hub,
      sections: term ? new Set(c.sections.filter((s) => s.term === term).map((s) => s.section)).size : undefined,
    })),
  );
}
