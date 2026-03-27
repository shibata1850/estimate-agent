import { NextRequest, NextResponse } from "next/server";
import { createMisocaEstimate, isMisocaConfigured } from "@/lib/misoca";
import type { EstimateData } from "@/types";

export async function POST(req: NextRequest) {
  try {
    if (!isMisocaConfigured()) {
      return NextResponse.json(
        { error: "MISOCA_ACCESS_TOKEN 環境変数が設定されていません" },
        { status: 500 }
      );
    }

    const { estimate, recipientName, planIndex } = (await req.json()) as {
      estimate: EstimateData;
      recipientName: string;
      planIndex: number;
    };

    const result = await createMisocaEstimate(estimate, recipientName, planIndex ?? 1);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "見積書の作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
