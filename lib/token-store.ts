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
  secure: true,
  sameSite: "lax" as const,
  maxAge: 86400, // 24時間
  path: "/",
};

/** Cookie からアクセストークンを取得 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

/** レスポンスにアクセストークン Cookie をセット */
export function setAccessTokenCookie(
  response: NextResponse,
  accessToken: string
): void {
  response.cookies.set(COOKIE_NAME, accessToken, COOKIE_OPTIONS);
}

/** レスポンスからアクセストークン Cookie を削除 */
export function deleteAccessTokenCookie(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME);
}
