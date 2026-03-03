/**
 * トークン保存（開発用: メモリ保存）
 * 本番環境では Vercel KV や Redis に差し替えてください
 *
 * 差し替え例 (Vercel KV):
 *   import { kv } from "@vercel/kv";
 *   export async function getToken() { return kv.get("misoca_token"); }
 *   export async function saveToken(t: any) { await kv.set("misoca_token", t); }
 *   export async function deleteToken() { await kv.del("misoca_token"); }
 */

import type { MisocaToken } from "@/types";

let stored: MisocaToken | null = null;

export async function getToken(): Promise<MisocaToken | null> {
  return stored;
}

export async function saveToken(token: MisocaToken): Promise<void> {
  stored = token;
}

export async function deleteToken(): Promise<void> {
  stored = null;
}
