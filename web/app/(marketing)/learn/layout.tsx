import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "统计知识小课堂 · 问卷分析必备知识",
  description:
    "从统计基础到分析方法、论文写作，系统学习问卷研究必备知识。涵盖信度效度、样本量估算、效应量解读等毕设高频考点，免费阅读本文。",
  keywords: [
    "问卷分析教程",
    "信度效度",
    "样本量计算",
    "效应量",
    "统计分析入门",
    "毕设问卷",
  ],
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
