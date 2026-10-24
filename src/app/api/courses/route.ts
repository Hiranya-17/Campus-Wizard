import { NextResponse } from "next/server";
import { getCourses } from "@/lib/data";

// GET /api/courses?q=logic%20design  or  ?code=ENG%20EC%20311
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const courses = getCourses();
  const code = searchParams.get("code");
  if (code) {
    const c = courses.get(code.toUpperCase());
    return c ? NextResponse.json(c) : NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();
  if (!q) return NextResponse.json([]);
  const hits = [];
  for (const c of courses.values()) {
    if (c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)) {
      hits.push({ code: c.code, title: c.title, units: c.units, hub: c.hub });
      if (hits.length >= 25) break;
    }
  }
  return NextResponse.json(hits);
}
