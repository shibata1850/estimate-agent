import type { MisocaToken, EstimateData, MisocaEstimate } from "@/types";
import { getAccessToken } from "./token-store";

const BASE_URL = "https://app.misoca.jp";
const API_URL = "https://app.misoca.jp/api/v3";

/* ─── OAuth 2.0 ─── */
export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.MISOCA_CLIENT_ID!,
    redirect_uri: process.env.MISOCA_REDIRECT_URI!,
    response_type: "code",
    scope: "write",
  });
  return `${BASE_URL}/oauth2/authorize?${params.toString()}`;
}

/**
 * 認可コードをトークンに交換する。
 * トークンの Cookie 保存は呼び出し元（callback route）が NextResponse 経由で行う。
 */
export async function exchangeCode(code: string): Promise<MisocaToken> {
  const res = await fetch(`${BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.MISOCA_CLIENT_ID!,
      client_secret: process.env.MISOCA_CLIENT_SECRET!,
      redirect_uri: process.env.MISOCA_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    throw new Error(`Misoca token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

/** Cookie からアクセストークンを取得（なければエラー） */
async function requireAccessToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Misoca未連携です。先にOAuth認証を行ってください。");
  }
  return token;
}

/* ─── 見積書作成 ─── */
export async function createMisocaEstimate(
  estimate: EstimateData,
  recipientName: string,
  planIndex: number
): Promise<{ id: string; url: string }> {
  const accessToken = await requireAccessToken();

  const today = new Date().toISOString().split("T")[0];
  const plan = estimate.plans[planIndex];

  if (!plan) throw new Error("指定されたプランが見つかりません");

  const body: MisocaEstimate = {
    subject: `${estimate.title}（${plan.tierLabel}）`,
    issue_date: today,
    recipient_name: recipientName,
    items: plan.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      unit: item.unit,
      description: item.description,
    })),
  };

  const res = await fetch(`${API_URL}/quotation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Misoca見積作成失敗: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    url: `${BASE_URL}/quotations/${data.id}`,
  };
}

/* ─── 連携状態チェック ─── */
export async function isMisocaConnected(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}
