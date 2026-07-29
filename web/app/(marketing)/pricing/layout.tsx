import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "定价 · 免费体检与付费生成",
  description:
    "免费体验问卷体检与可行性确认，付费生成模拟数据与完整统计报告。单次与月度订阅灵活选择，开题季早鸟价进行中。",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "定价 · 数据分析智能体",
    description: "免费体检确认可行性，付费生成数据与完整报告",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
