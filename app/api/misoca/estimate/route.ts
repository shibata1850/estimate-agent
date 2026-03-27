import { NextRequest, NextResponse } from "next/server";
import { createMisocaEstimate, isMisocaConnected } from "@/lib/misoca";
import type { EstimateData } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const connected = await isMisocaConnected();
    console.log("[misoca/estimate] isMisocaConnected:", connected);
    if (!connected) {
      return NextResponse.json(
        { error: "Misocaに未連携です。先にOAuth認証を行ってください。" },
        { status: 401 }
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
