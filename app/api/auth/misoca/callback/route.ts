import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/misoca";
import { setAccessTokenCookie } from "@/lib/token-store";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/?error=misoca_auth_failed", req.url)
    );
  }

  try {
    const token = await exchangeCode(code);
    const response = NextResponse.redirect(
      new URL("/?misoca=connected", req.url)
    );
    setAccessTokenCookie(response, token.access_token);
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/?error=misoca_token_failed", req.url)
    );
  }
}
