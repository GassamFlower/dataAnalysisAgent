import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服务与咨询 | 数据分析智能体",
  description:
    "问卷题目免费体检，确认题目与假设方向是否可行；数据预演、统计报告与导出等完整能力，直接联系客服开通。",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "服务与咨询 · 数据分析智能体",
    description: "免费体检确认可行性，完整能力联系客服开通",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
