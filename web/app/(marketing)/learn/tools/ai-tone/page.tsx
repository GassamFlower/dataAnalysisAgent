import type { Metadata } from "next";

import { AiToneTool } from "@/components/ai-tone/ai-tone-tool";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "文字体检 · 去 AI 味 | 免费检测论文写作痕迹",
  description:
    "免费检测论文或文章中的机械化写作痕迹：对举句式、提示语冒号、句首连接词、顿号并列、结构均匀度与标点指纹。先看报告，再按建议做最小改写。",
  keywords: [
    "去 AI 味",
    "AI 味检测",
    "论文润色",
    "文字体检",
    "AI 写作痕迹",
    "论文写作",
  ],
};

export default function AiToneToolPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <AiToneTool />
      <SiteFooter />
    </div>
  );
}
