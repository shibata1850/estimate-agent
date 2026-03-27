import { NextResponse } from 'next/server'

export async function GET() {
  const url = `https://app.misoca.jp/oauth2/authorize?client_id=${process.env.MISOCA_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.MISOCA_REDIRECT_URI!)}&response_type=code&scope=write`
  return NextResponse.redirect(url)
}
