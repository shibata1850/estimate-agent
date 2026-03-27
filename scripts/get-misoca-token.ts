/**
 * Misoca アクセストークン取得スクリプト（ワンタイム実行）
 *
 * 使い方:
 *   1. .env に MISOCA_CLIENT_ID と MISOCA_CLIENT_SECRET を設定
 *   2. npx tsx scripts/get-misoca-token.ts
 *   3. ブラウザで表示されたURLを開いて認可
 *   4. リダイレクト先URLからcodeをコピーしてターミナルに貼り付け
 *   5. 表示されたアクセストークンをVercelの環境変数 MISOCA_ACCESS_TOKEN に設定
 */

import * as http from "http";
import * as url from "url";

const CLIENT_ID = process.env.MISOCA_CLIENT_ID;
const CLIENT_SECRET = process.env.MISOCA_CLIENT_SECRET;
const PORT = 8910;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const BASE_URL = "https://app.misoca.jp";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n❌ 環境変数が未設定です。.env に以下を設定してください:\n");
  console.error("  MISOCA_CLIENT_ID=あなたのクライアントID");
  console.error("  MISOCA_CLIENT_SECRET=あなたのクライアントシークレット\n");
  console.error("実行例: MISOCA_CLIENT_ID=xxx MISOCA_CLIENT_SECRET=yyy npx tsx scripts/get-misoca-token.ts\n");
  process.exit(1);
}

async function exchangeCode(code: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`\n❌ トークン交換に失敗しました (${res.status}):`);
    console.error(body);
    process.exit(1);
  }

  const data = JSON.parse(body);

  console.log("\n" + "=".repeat(60));
  console.log("✅ アクセストークンを取得しました！");
  console.log("=".repeat(60));
  console.log(`\n  MISOCA_ACCESS_TOKEN=${data.access_token}\n`);

  if (data.refresh_token) {
    console.log(`  MISOCA_REFRESH_TOKEN=${data.refresh_token}\n`);
  }
  if (data.expires_in) {
    console.log(`  有効期限: ${data.expires_in}秒 (${Math.round(data.expires_in / 3600)}時間)\n`);
  }

  console.log("=".repeat(60));
  console.log("👉 上記の MISOCA_ACCESS_TOKEN を Vercel の環境変数に設定してください");
  console.log("=".repeat(60) + "\n");
}

// ローカルHTTPサーバーでコールバックを受け取る
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (parsed.pathname === "/callback") {
    const code = parsed.query.code as string | undefined;

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>❌ エラー: 認可コードがありません</h1>");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>✅ 認可コードを受け取りました。ターミナルを確認してください。</h1><p>このタブは閉じてOKです。</p>");

    await exchangeCode(code);
    server.close();
    process.exit(0);
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  const authUrl = `${BASE_URL}/oauth2/authorize?` + new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "write",
  }).toString();

  console.log("\n" + "=".repeat(60));
  console.log("  Misoca アクセストークン取得ツール");
  console.log("=".repeat(60));
  console.log("\n👉 以下のURLをブラウザで開いて、Misocaアカウントを認可してください:\n");
  console.log(`  ${authUrl}\n`);
  console.log(`⏳ コールバック待機中 (http://localhost:${PORT}/callback) ...\n`);
});
