import { NextResponse } from "next/server";

const BASE_URL = "https://app.misoca.jp";

export async function GET() {
  const clientId = process.env.MISOCA_CLIENT_ID;
  const redirectUri = process.env.MISOCA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "MISOCA_CLIENT_ID / MISOCA_REDIRECT_URI が未設定です" },
      { status: 500 }
    );
  }

  const authUrl = `${BASE_URL}/oauth2/authorize?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "write",
  }).toString();

  return NextResponse.redirect(authUrl);
}
