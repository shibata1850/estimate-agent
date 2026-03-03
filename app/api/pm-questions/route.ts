import { NextRequest, NextResponse } from "next/server";
import { generatePMQuestions } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    const questions = await generatePMQuestions(input);
    return NextResponse.json({ questions: JSON.parse(questions) });
  } catch (e) {
    return NextResponse.json({ error: "質問生成に失敗: " + (e instanceof Error ? e.message : "") }, { status: 500 });
  }
}
