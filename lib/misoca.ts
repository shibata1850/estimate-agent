import type { EstimateData } from "@/types";

const BASE_URL = "https://app.misoca.jp";
const API_URL = "https://app.misoca.jp/api/v3";

function getAccessToken(): string {
  const token = process.env.MISOCA_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MISOCA_ACCESS_TOKEN 環境変数が設定されていません");
  }
  return token;
}

/* ─── 取引先を検索、なければ新規作成 ─── */
async function findOrCreateContact(
  accessToken: string,
  companyName: string
): Promise<number> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // 既存の取引先から検索
  try {
    const res = await fetch(`${API_URL}/contacts`, { headers });
    if (res.ok) {
      const contacts = await res.json();
      if (Array.isArray(contacts)) {
        const match = contacts.find(
          (c: { name?: string }) => c.name && c.name.includes(companyName)
        );
        if (match) return Number(match.id);
      }
    }
  } catch {
    // 検索失敗時は新規作成へ
  }

  // 一致する取引先がない場合、新規作成
  const createRes = await fetch(`${API_URL}/contact`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient_name: companyName,
      recipient_title: "御中",
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`取引先の作成に失敗しました: ${createRes.status} ${errText}`);
  }

  const created = await createRes.json();
  return Number(created.id);
}

/* ─── 備考欄を組み立てる ─── */
function buildNotes(estimate: EstimateData, plan: EstimateData["plans"][0]): string {
  const lines: string[] = [];

  // 概要
  if (estimate.summary) {
    lines.push(`【概要】\n${estimate.summary}`);
  }

  // 納期
  if (plan.deliveryDate) {
    lines.push(`【納期】${plan.deliveryDate}（約${plan.estimatedDays}営業日）`);
  }

  // 見積有効期限
  if (estimate.validUntil) {
    lines.push(`【見積有効期限】${estimate.validUntil}`);
  }

  // 支払条件
  if (estimate.paymentTerms) {
    lines.push(`【支払条件】${estimate.paymentTerms}`);
  }

  // 月額運用費
  if (plan.monthlyOperationCost > 0) {
    lines.push(`【月額運用費（参考）】${plan.monthlyOperationCost.toLocaleString("ja-JP")}円/月`);
  }

  // 前提条件（スコープ）
  const scope = estimate.preconditions;
  if (scope?.scope?.length > 0) {
    lines.push(`【対応範囲】\n${scope.scope.map((s) => `・${s}`).join("\n")}`);
  }
  if (scope?.outOfScope?.length > 0) {
    lines.push(`【対応範囲外】\n${scope.outOfScope.map((s) => `・${s}`).join("\n")}`);
  }

  // 備考
  if (estimate.notes) {
    lines.push(`【備考】\n${estimate.notes}`);
  }

  return lines.join("\n\n");
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

  const contactId = await findOrCreateContact(accessToken, recipientName);

  // 明細行: 各項目 + リスクバッファ
  const items = plan.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    unit_name: item.unit,
    tax_type: "STANDARD_TAX_10",
  }));

  // リスクバッファがあれば別明細行として追加
  if (plan.riskBuffer > 0) {
    items.push({
      name: "リスクバッファ（予備費）",
      quantity: 1,
      unit_price: plan.riskBuffer,
      unit_name: "式",
      tax_type: "STANDARD_TAX_10",
    });
  }

  const body = {
    issue_date: today,
    contact_id: contactId,
    subject: `${estimate.title}（${plan.tierLabel}）`,
    notes: buildNotes(estimate, plan),
    items,
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
    url: `${BASE_URL}/estimates/${data.id}`,
  };
}

/* ─── 設定チェック ─── */
export function isMisocaConfigured(): boolean {
  return !!process.env.MISOCA_ACCESS_TOKEN;
}
