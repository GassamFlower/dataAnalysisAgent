import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "套餐与定价 | 数据分析智能体",
  description:
    "问卷题目免费体检，确认题目与假设方向是否可行；数据预演、统计报告与导出等完整能力，选择套餐扫码即用。",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "套餐与定价 · 数据分析智能体",
    description: "免费体检确认可行性，完整能力自助扫码开通",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
