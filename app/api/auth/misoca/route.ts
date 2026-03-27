import { NextResponse } from "next/server";
import { getAuthUrl, isMisocaConnected } from "@/lib/misoca";

export async function GET() {
  // 連携状態チェック
  const connected = await isMisocaConnected();
  console.log("[auth/misoca] isMisocaConnected:", connected);

  if (connected) {
    return NextResponse.json({ connected: true });
  }

  // Misoca Client IDが未設定の場合
  if (!process.env.MISOCA_CLIENT_ID) {
    console.log("[auth/misoca] MISOCA_CLIENT_ID not set");
    return NextResponse.json({
      connected: false,
      error: "Misoca APIの設定がされていません",
    });
  }

  return NextResponse.json({
    connected: false,
    authUrl: getAuthUrl(),
  });
}
