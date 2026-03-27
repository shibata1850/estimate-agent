/**
 * Misoca トークン Cookie ヘルパー
 *
 * 読み取り: cookies() (next/headers) — Route Handler / Server Component で利用可
 * 書き込み: NextResponse.cookies.set() — レスポンスに直接セット
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "misoca_access_token";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 86400, // 24時間
  path: "/",
};

/** Cookie からアクセストークンを取得 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const store = cookies();
    const value = store.get(COOKIE_NAME)?.value ?? null;
    console.log("[token-store] getAccessToken:", value ? `found (${value.slice(0, 8)}...)` : "not found");
    return value;
  } catch (e) {
    console.error("[token-store] getAccessToken error:", e);
    return null;
  }
}

/** レスポンスにアクセストークン Cookie をセット */
export function setAccessTokenCookie(
  response: NextResponse,
  accessToken: string
): void {
  console.log("[token-store] setAccessTokenCookie:", accessToken.slice(0, 8) + "...");
  console.log("[token-store] cookie options:", JSON.stringify(COOKIE_OPTIONS));
  response.cookies.set(COOKIE_NAME, accessToken, COOKIE_OPTIONS);
  // Set-Cookie ヘッダーが付与されたか確認
  console.log("[token-store] Set-Cookie header:", response.headers.get("set-cookie"));
}

/** レスポンスからアクセストークン Cookie を削除 */
export function deleteAccessTokenCookie(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME);
}
