import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/misoca";
import { setAccessTokenCookie } from "@/lib/token-store";

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
    const token = await exchangeCode(code);
    console.log("[misoca/callback] exchangeCode success, access_token:", token.access_token.slice(0, 8) + "...");

    const redirectUrl = new URL("/?misoca=connected", req.url);
    console.log("[misoca/callback] redirecting to:", redirectUrl.toString());

    const response = NextResponse.redirect(redirectUrl);
    setAccessTokenCookie(response, token.access_token);

    console.log("[misoca/callback] response status:", response.status);
    console.log("[misoca/callback] response headers:", Object.fromEntries(response.headers.entries()));

    return response;
  } catch (e) {
    console.error("[misoca/callback] exchangeCode failed:", e);
    return NextResponse.redirect(
      new URL("/?error=misoca_token_failed", req.url)
    );
  }
}
