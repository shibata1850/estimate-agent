import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "見積書自動生成エージェント | SOFTDOING",
  description:
    "地域・業種・企業の3段階AI分析に基づいて、根拠ある見積書を自動生成します。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
