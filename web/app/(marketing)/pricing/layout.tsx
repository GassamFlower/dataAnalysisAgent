import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服务与价格 | 预演研究预演工作台",
  description:
    "问卷题目免费体检，确认题目与假设方向是否可行；数据预演、统计报告与导出等完整能力按服务包开通，小红书店铺下单后由客服开通。",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "服务与价格 · 预演研究预演工作台",
    description: "免费体检确认可行性，服务包在小红书店铺下单",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
