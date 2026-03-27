import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://app.misoca.jp";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return new NextResponse(
      "<html><body><h1>エラー: 認可コードがありません</h1></body></html>",
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const clientId = process.env.MISOCA_CLIENT_ID;
  const clientSecret = process.env.MISOCA_CLIENT_SECRET;
  const redirectUri = process.env.MISOCA_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return new NextResponse(
      "<html><body><h1>エラー: 環境変数が未設定です</h1></body></html>",
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
      `<html><body style="font-family:sans-serif;padding:40px">
        <h1>トークン取得失敗 (${res.status})</h1>
        <pre>${body.replace(/</g, "&lt;")}</pre>
      </body></html>`,
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const data = JSON.parse(body);

  return new NextResponse(
    `<html>
<body style="font-family:sans-serif;padding:40px">
  <h1>アクセストークン取得成功</h1>
  <p>以下をコピーしてVercelの MISOCA_ACCESS_TOKEN に設定してください</p>
  <textarea style="width:100%;height:100px;font-size:12px" onclick="this.select()">${data.access_token}</textarea>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
