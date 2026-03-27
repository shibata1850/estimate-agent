import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.MISOCA_CLIENT_ID
  const redirectUri = process.env.MISOCA_REDIRECT_URI
  const url = `https://app.misoca.jp/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri!)}&response_type=code&scope=write`
  return NextResponse.redirect(url)
}
