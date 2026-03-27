import { NextResponse } from "next/server";

export async function GET() {
  const accessToken = process.env.MISOCA_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "MISOCA_ACCESS_TOKEN not set" }, { status: 500 });
  }

  const results: Record<string, unknown> = {};

  // Swagger仕様を取得
  try {
    const swaggerRes = await fetch("https://app.misoca.jp/api/v3/swagger_doc", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    results.swagger_status = swaggerRes.status;
    results.swagger_body = await swaggerRes.text();
  } catch (e) {
    results.swagger_error = String(e);
  }

  // 取引先一覧を取得
  try {
    const contactsRes = await fetch("https://app.misoca.jp/api/v3/contacts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    results.contacts_status = contactsRes.status;
    results.contacts_body = await contactsRes.text();
  } catch (e) {
    results.contacts_error = String(e);
  }

  return NextResponse.json(results);
}
