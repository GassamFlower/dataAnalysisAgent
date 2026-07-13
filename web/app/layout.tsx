import type { Metadata } from "next";
import { Fraunces, Noto_Sans_SC } from "next/font/google";

import { Providers } from "@/lib/providers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans",
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "数据分析智能体 · 问卷研究预演工具",
    template: "%s · 数据分析智能体",
  },
  description:
    "提前模拟数据方向及趋势，避免问卷研究的白做工。面向本科毕设生的研究预演工具。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${fraunces.variable} ${notoSansSC.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
