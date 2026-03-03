import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/misoca";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/?error=misoca_auth_failed", req.url)
    );
  }

  try {
    await exchangeCode(code);
    return NextResponse.redirect(
      new URL("/?misoca=connected", req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/?error=misoca_token_failed", req.url)
    );
  }
}
