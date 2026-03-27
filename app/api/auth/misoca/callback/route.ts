import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return new Response('<h1>エラー: codeがありません</h1>', {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  const res = await fetch('https://app.misoca.jp/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.MISOCA_REDIRECT_URI!,
      client_id: process.env.MISOCA_CLIENT_ID!,
      client_secret: process.env.MISOCA_CLIENT_SECRET!,
    })
  })

  const text = await res.text()

  return new Response(`
    <html>
    <body style="font-family:sans-serif;padding:40px">
      <h1>レスポンス（status: ${res.status}）</h1>
      <textarea style="width:100%;height:200px">${text}</textarea>
    </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } })
}
