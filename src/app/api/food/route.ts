import { NextResponse } from "next/server";
import { getFood } from "@/lib/data";

// GET /api/food -> FoodQuote[]
export async function GET() {
  return NextResponse.json(getFood());
}
