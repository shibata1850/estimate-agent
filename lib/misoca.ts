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
  const clientId = process.env.MISOCA_CLIENT_ID;
  const clientSecret = process.env.MISOCA_CLIENT_SECRET;
  const redirectUri = process.env.MISOCA_REDIRECT_URI;

  console.log("[exchangeCode] env check:", {
    MISOCA_CLIENT_ID: clientId ? `${clientId.slice(0, 4)}...(${clientId.length}chars)` : "MISSING",
    MISOCA_CLIENT_SECRET: clientSecret ? `${clientSecret.slice(0, 4)}...(${clientSecret.length}chars)` : "MISSING",
    MISOCA_REDIRECT_URI: redirectUri ?? "MISSING",
  });

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Misoca環境変数が未設定です: " + [
      !clientId && "MISOCA_CLIENT_ID",
      !clientSecret && "MISOCA_CLIENT_SECRET",
      !redirectUri && "MISOCA_REDIRECT_URI",
    ].filter(Boolean).join(", "));
  }

  const tokenUrl = `${BASE_URL}/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  console.log("[exchangeCode] POST", tokenUrl);
  console.log("[exchangeCode] params:", {
    grant_type: "authorization_code",
    code: code.slice(0, 8) + "...",
    client_id: clientId.slice(0, 4) + "...",
    redirect_uri: redirectUri,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  console.log("[exchangeCode] response status:", res.status, res.statusText);
  console.log("[exchangeCode] response headers:", Object.fromEntries(res.headers.entries()));

  const rawBody = await res.text();
  console.log("[exchangeCode] response body:", rawBody);

  if (!res.ok) {
    throw new Error(`Misoca token exchange failed: ${res.status} ${rawBody}`);
  }

  const data = JSON.parse(rawBody);
  console.log("[exchangeCode] token received:", {
    access_token: data.access_token ? `${data.access_token.slice(0, 8)}...(${data.access_token.length}chars)` : "MISSING",
    refresh_token: data.refresh_token ? "present" : "MISSING",
    expires_in: data.expires_in,
  });

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
