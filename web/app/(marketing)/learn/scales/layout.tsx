import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "学科量表库 · 常用问卷量表一键导入",
  description:
    "管理学、教育学、心理学常用学术量表库，支持按学科筛选。一键创建项目并导入量表题目，免去手工录题，直接进入预演。",
  keywords: ["量表库", "学术量表", "心理学量表", "管理学量表", "问卷量表", "量表导入"],
};

export default function ScalesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
