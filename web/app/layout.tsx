import type { Metadata } from "next";

import { Providers } from "@/lib/providers";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = "数据分析智能体";
const SITE_DESCRIPTION =
  "提前模拟数据方向及趋势，避免问卷研究的白做工。面向本科毕设生的研究预演工具。";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} · 问卷研究预演工具`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "问卷研究",
    "数据分析",
    "统计预演",
    "信效度分析",
    "差异检验",
    "回归分析",
    "本科毕设",
    "Cronbach α",
    "KMO",
    "Bartlett",
    "智能诊断",
    "模拟数据生成",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} · 问卷研究预演工具`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · 问卷研究预演工具`,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "CNY",
    description: "免费体检确认可行性，付费生成数据与完整报告",
  },
  featureList: [
    "问卷题目智能识别与维度归属",
    "模拟数据生成（多元正态 + Likert）",
    "信效度分析（Cronbach α、KMO、Bartlett）",
    "差异检验（t 检验、ANOVA、卡方、回归）",
    "智能诊断与翻车点检测",
    "Word/Excel 报告导出",
    "统计知识课堂与 AI 解读助手",
  ],
  audience: {
    "@type": "EducationalAudience",
    educationalRole: "student",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </body>
    </html>
  );
}
