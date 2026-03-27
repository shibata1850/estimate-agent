import type { EstimateData, MisocaEstimate } from "@/types";

const BASE_URL = "https://app.misoca.jp";
const API_URL = "https://app.misoca.jp/api/v3";

function getAccessToken(): string {
  const token = process.env.MISOCA_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MISOCA_ACCESS_TOKEN 環境変数が設定されていません");
  }
  return token;
}

/* ─── 見積書作成 ─── */
export async function createMisocaEstimate(
  estimate: EstimateData,
  recipientName: string,
  planIndex: number
): Promise<{ id: string; url: string }> {
  const accessToken = getAccessToken();

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

  const res = await fetch(`${API_URL}/estimates`, {
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

/* ─── 設定チェック ─── */
export function isMisocaConfigured(): boolean {
  return !!process.env.MISOCA_ACCESS_TOKEN;
}
