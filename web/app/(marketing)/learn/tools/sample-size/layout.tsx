import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "样本量计算器 · 免费估算论文所需样本量",
  description:
    "免费在线样本量计算器。输入效应量、显著性水平和统计功效，快速估算论文所需的有效样本量，适用于 t 检验、ANOVA 等常见分析方法。",
  keywords: [
    "样本量计算",
    "样本量估算",
    "G*Power",
    "效应量",
    "统计功效",
    "论文样本量",
  ],
};

export default function SampleSizeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
