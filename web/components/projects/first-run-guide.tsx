"use client";

import Link from "next/link";
import { Plus, ClipboardList, Activity, FileBarChart } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * M4 首次进入「我的项目」时的引导：把"空"变成"下一步进度感"。
 * 用三步向导告诉第一次来的用户：从这里到拿到报告只需 3 步。
 */

const STEPS = [
  {
    icon: ClipboardList,
    title: "上传题目",
    desc: "粘贴问卷文本或上传 .docx / .txt，自动识别题型与维度。",
  },
  {
    icon: Activity,
    title: "免费体检 + 预演",
    desc: "看信效度是否达标、一句话预演假设是否成立。",
  },
  {
    icon: FileBarChart,
    title: "生成预演报告",
    desc: "一份能直接贴进论文的统计结果与诊断报告。",
  },
];

export function FirstRunGuide() {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-dashed border-border bg-cream-surface/50 px-6 py-10 text-center">
      <h2 className="font-display text-h2 font-semibold text-ink-900">
        三步，把论文的数据拿到手
      </h2>
      <p className="mt-2 text-body text-ink-500">
        从上传题目到拿到一份能贴进论文的预演报告，全程不用装 SPSS、不用读统计教程。
      </p>

      <ol className="mt-8 space-y-4 text-left">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-4">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
            </div>
            <div className="pt-0.5">
              <div className="text-h3 font-semibold text-ink-900">{s.title}</div>
              <p className="mt-1 text-body text-ink-500">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <Button size="lg" asChild>
          <Link href="/projects/new">
            <Plus className="mr-1.5 h-4 w-4" />
            创建第一个项目，开始免费体检
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default FirstRunGuide;