import { NextRequest, NextResponse } from "next/server";
import { setAccessTokenCookie } from "@/lib/token-store";

const BASE_URL = "https://app.misoca.jp";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  console.log("[misoca/callback] received code:", code ? `${code.slice(0, 8)}...` : "null");

  if (!code) {
    console.log("[misoca/callback] no code, redirecting to error");
    return NextResponse.redirect(
      new URL("/?error=misoca_auth_failed", req.url)
    );
  }

  try {
    // --- トークン交換を直接実行してログを出す ---
    const clientId = process.env.MISOCA_CLIENT_ID;
    const clientSecret = process.env.MISOCA_CLIENT_SECRET;
    const redirectUri = process.env.MISOCA_REDIRECT_URI;

    console.log("[misoca/callback] env:", {
      MISOCA_CLIENT_ID: clientId ? `${clientId.slice(0, 4)}...(${clientId.length}chars)` : "MISSING",
      MISOCA_CLIENT_SECRET: clientSecret ? `${clientSecret.slice(0, 4)}...(${clientSecret.length}chars)` : "MISSING",
      MISOCA_REDIRECT_URI: redirectUri ?? "MISSING",
    });

    const tokenUrl = `${BASE_URL}/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri!,
    });

    console.log("[misoca/callback] POST", tokenUrl);

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const body = await res.text();
    console.log("[misoca token response] status:", res.status);
    console.log("[misoca token response] body:", body);

    if (!res.ok) {
      throw new Error(`Misoca token exchange failed: ${res.status} ${body}`);
    }

    const data = JSON.parse(body);
    console.log("[misoca/callback] token parsed:", {
      access_token: data.access_token ? `${data.access_token.slice(0, 8)}...` : "MISSING",
      refresh_token: data.refresh_token ? "present" : "MISSING",
      expires_in: data.expires_in,
    });

    const redirectUrl = new URL("/?misoca=connected", req.url);
    const response = NextResponse.redirect(redirectUrl);
    setAccessTokenCookie(response, data.access_token);

    console.log("[misoca/callback] redirect to:", redirectUrl.toString());
    console.log("[misoca/callback] Set-Cookie:", response.headers.get("set-cookie"));

    return response;
  } catch (e) {
    console.error("[misoca/callback] error:", e);
    return NextResponse.redirect(
      new URL("/?error=misoca_token_failed", req.url)
    );
  }
}
