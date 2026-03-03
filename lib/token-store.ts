/**
 * トークン保存（Cookie版 — Vercel対応）
 */
import { cookies } from "next/headers";
import type { MisocaToken } from "@/types";

const COOKIE_NAME = "misoca_token";

export async function getToken(): Promise<MisocaToken | null> {
  try {
    const cookieStore = cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return null;
    return JSON.parse(raw) as MisocaToken;
  } catch {
    return null;
  }
}

export async function saveToken(token: MisocaToken): Promise<void> {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: "/",
  });
}

export async function deleteToken(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
