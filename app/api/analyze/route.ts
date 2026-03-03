import { NextRequest } from "next/server";
import { runAnalysis } from "@/lib/gemini";
import type { EstimateInput } from "@/types";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const input: EstimateInput = await req.json();

    // バリデーション
    if (!input.region || !input.industry || !input.companyName || !input.requirements) {
      return new Response(
        JSON.stringify({ error: "地域・業種・企業名・要望は全て必須です" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // SSEストリーム
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(type: string, step: string | null, data: string) {
          const payload = JSON.stringify({ type, step, data });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }

        try {
          await runAnalysis(input, (type, step, data) => {
            send(type, step, data);
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "分析中にエラーが発生しました";
          send("error", null, message);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "リクエストの処理に失敗しました" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
