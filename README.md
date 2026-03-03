# 見積書自動生成エージェント

地域・業種・企業名・要望を入力すると、AIが4段階の分析を行い、根拠ある見積書を自動生成します。

## 動作フロー

```
┌──────────────────────────────────┐
│  入力フォーム                     │
│  地域 / 業種 / 企業名 / 要望     │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Step 1: 地域分析                 │  ← Claude API
│  経済環境・人口動態・補助金情報    │
└──────────────┬───────────────────┘
               │ 分析結果を次のステップへ引き継ぎ
               ▼
┌──────────────────────────────────┐
│  Step 2: 業種分析                 │  ← Claude API
│  地域×業種の市場環境・DX状況      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Step 3: 企業分析                 │  ← Claude API
│  ニーズ解釈・推奨ソリューション    │
└──────────────┬───────────────────┘
               │ 3段階の分析結果を統合
               ▼
┌──────────────────────────────────┐
│  Step 4: 見積書生成               │  ← Claude API (Tool Use)
│  構造化された見積データを抽出      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Misoca API で見積書PDF作成       │
└──────────────────────────────────┘
```

## 技術スタック

| 技術 | 用途 |
|------|------|
| Next.js 14 (App Router) | フルスタックフレームワーク |
| TypeScript (strict) | 型安全性 |
| Tailwind CSS | スタイリング |
| Claude API (Tool Use) | 4段階AI分析 + 構造化データ抽出 |
| Misoca API (OAuth 2.0) | 見積書PDF作成 |
| Vercel | ホスティング |
| GitHub | ソース管理 |

## セットアップ

```bash
git clone https://github.com/YOUR_USERNAME/estimate-agent.git
cd estimate-agent
npm install
cp .env.example .env
# .env に ANTHROPIC_API_KEY を設定
npm run dev
```

## デプロイ（Vercel + GitHub）

```bash
# 1. GitHubにpush
git remote add origin https://github.com/YOUR_USERNAME/estimate-agent.git
git push -u origin main

# 2. Vercelでインポート → 環境変数設定 → Deploy
```

環境変数:
- `ANTHROPIC_API_KEY` (必須)
- `MISOCA_CLIENT_ID` / `MISOCA_CLIENT_SECRET` / `MISOCA_REDIRECT_URI` (Misoca連携時)

## Claude Code での開発

```bash
# Claude Code で起動
claude

# 開発サーバー起動
> npm run dev

# 新機能の追加
> 見積書のPDFエクスポート機能を追加して
```

## トークン保存の差し替え

`lib/token-store.ts` を Vercel KV に差し替え:

```typescript
import { kv } from "@vercel/kv";
export async function getToken() { return kv.get("misoca_token"); }
export async function saveToken(t) { await kv.set("misoca_token", t); }
```
