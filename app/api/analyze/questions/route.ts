import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const maxDuration = 60;

/**
 * 入力内容から追加で確認すべき質問を生成する（オプション機能）
 */
export async function POST(req: NextRequest) {
  try {
    const { region, industry, companyName, requirements } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(
      `あなたはIT企業の営業担当です。以下の情報から見積を作成しますが、より正確な見積のために追加で確認したい質問を3つ生成してください。

【地域】${region}
【業種】${industry}
【企業名】${companyName}
【要望】${requirements}

JSON形式で出力してください:
[
  {"id": "q1", "question": "質問文", "placeholder": "回答例"},
  {"id": "q2", "question": "質問文", "placeholder": "回答例"},
  {"id": "q3", "question": "質問文", "placeholder": "回答例"}
]

JSONのみを出力し、他の文章は含めないでください。`
    );

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    const questions = JSON.parse(cleaned);

    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json(
      { error: "質問の生成に失敗しました" },
      { status: 500 }
    );
  }
}
