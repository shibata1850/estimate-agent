import type { EstimateData } from "@/types";

const BASE_URL = "https://app.misoca.jp";
const API_URL = "https://app.misoca.jp/api/v3";

const DEFAULT_CONTACT_ID = 2869196;

function getAccessToken(): string {
  const token = process.env.MISOCA_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MISOCA_ACCESS_TOKEN 環境変数が設定されていません");
  }
  return token;
}

/* ─── 取引先ID取得（会社名で検索） ─── */
async function findContactId(accessToken: string, companyName: string): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/contacts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return DEFAULT_CONTACT_ID;

    const contacts = await res.json();
    if (!Array.isArray(contacts) || contacts.length === 0) return DEFAULT_CONTACT_ID;

    const match = contacts.find(
      (c: { name?: string }) => c.name && c.name.includes(companyName)
    );
    return match ? Number(match.id) : Number(contacts[0].id);
  } catch {
    return DEFAULT_CONTACT_ID;
  }
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

  const contactId = await findContactId(accessToken, recipientName);

  const body = {
    issue_date: today,
    contact_id: contactId,
    subject: `${estimate.title}（${plan.tierLabel}）`,
    items: plan.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      unit_name: item.unit,
      tax_type: "STANDARD_TAX_10",
    })),
  };

  const res = await fetch(`${API_URL}/estimate`, {
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
