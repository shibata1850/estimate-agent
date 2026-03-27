import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://app.misoca.jp";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return new NextResponse(
      html("エラー", "<p style='color:red'>認可コードがありません。もう一度 /api/auth/misoca にアクセスしてください。</p>"),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const clientId = process.env.MISOCA_CLIENT_ID;
  const clientSecret = process.env.MISOCA_CLIENT_SECRET;
  const redirectUri = process.env.MISOCA_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return new NextResponse(
      html("エラー", "<p style='color:red'>環境変数 MISOCA_CLIENT_ID / MISOCA_CLIENT_SECRET / MISOCA_REDIRECT_URI が未設定です。</p>"),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const res = await fetch(`${BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  const body = await res.text();

  if (!res.ok) {
    return new NextResponse(
      html("トークン取得失敗", `
        <p style="color:red">Misoca トークン交換に失敗しました (${res.status})</p>
        <pre style="background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto">${escapeHtml(body)}</pre>
      `),
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const data = JSON.parse(body);

  return new NextResponse(
    html("アクセストークン取得成功", `
      <p style="color:green;font-weight:bold;font-size:18px">✅ トークンを取得しました</p>

      <label style="font-weight:bold;display:block;margin-top:24px">MISOCA_ACCESS_TOKEN:</label>
      <textarea id="token" readonly onclick="this.select()" style="
        width:100%;height:120px;font-family:monospace;font-size:14px;
        padding:12px;border:2px solid #2563eb;border-radius:8px;margin-top:8px;
        background:#f0f9ff;word-break:break-all;resize:vertical;
      ">${escapeHtml(data.access_token)}</textarea>
      <button onclick="navigator.clipboard.writeText(document.getElementById('token').value).then(()=>{this.textContent='✅ コピーしました!'})" style="
        margin-top:12px;padding:10px 24px;background:#2563eb;color:white;
        border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;
      ">📋 コピー</button>

      <div style="margin-top:32px;padding:16px;background:#fefce8;border:1px solid #facc15;border-radius:8px">
        <p style="font-weight:bold">👉 次のステップ:</p>
        <ol style="margin-top:8px;padding-left:20px;line-height:2">
          <li>上のトークンをコピー</li>
          <li>Vercel → Settings → Environment Variables</li>
          <li><code>MISOCA_ACCESS_TOKEN</code> に貼り付けて保存</li>
          <li>Deployments → 最新デプロイを Redeploy</li>
        </ol>
      </div>

      ${data.refresh_token ? `
        <details style="margin-top:24px">
          <summary style="cursor:pointer;font-weight:bold">Refresh Token (参考)</summary>
          <textarea readonly onclick="this.select()" style="
            width:100%;height:80px;font-family:monospace;font-size:13px;
            padding:8px;border:1px solid #ccc;border-radius:4px;margin-top:8px;
          ">${escapeHtml(data.refresh_token)}</textarea>
        </details>
      ` : ""}

      ${data.expires_in ? `
        <p style="margin-top:16px;color:#666;font-size:14px">
          有効期限: ${data.expires_in}秒 (約${Math.round(data.expires_in / 3600)}時間)
        </p>
      ` : ""}

      <p style="margin-top:24px;padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#dc2626;font-size:13px">
        ⚠️ このページはトークン取得用の一時ページです。トークン設定後に /api/auth/misoca 関連のルートは削除してください。
      </p>
    `),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function html(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="max-width:640px;margin:40px auto;padding:0 20px;font-family:-apple-system,sans-serif">
<h1 style="font-size:24px">${title}</h1>${body}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
