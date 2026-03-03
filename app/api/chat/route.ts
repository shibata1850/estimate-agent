import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { question, context } = await req.json();
    if (!question) return NextResponse.json({ error: "質問は必須です" }, { status: 400 });
    const answer = await chat(question, context || "");
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "回答生成に失敗しました" }, { status: 500 });
  }
}
