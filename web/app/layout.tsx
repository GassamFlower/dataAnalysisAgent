import type { Metadata } from "next";

import { Providers } from "@/lib/providers";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

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
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
