import { NextRequest, NextResponse } from "next/server";
import { analyzeHiddenCosts } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    const costs = await analyzeHiddenCosts(input);
    return NextResponse.json({ costs: JSON.parse(costs) });
  } catch (e) {
    return NextResponse.json({ error: "隠れコスト分析に失敗: " + (e instanceof Error ? e.message : "") }, { status: 500 });
  }
}
