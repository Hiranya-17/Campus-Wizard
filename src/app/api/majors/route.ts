import { NextResponse } from "next/server";
import { getMajor, listMajors } from "@/lib/data";

// GET /api/majors -> [{id, name}]   GET /api/majors?id=ce -> Major
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json(listMajors());
  const m = getMajor(id);
  return m ? NextResponse.json(m) : NextResponse.json({ error: "not found" }, { status: 404 });
}
