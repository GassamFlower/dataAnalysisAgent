"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { aiToneApi } from "@/lib/api/ai-tone";
import { useQuota } from "@/lib/hooks/use-payment";
import { useAuthStore } from "@/lib/stores/auth-store";
import type {
  AiToneAnalysis,
  AiToneFingerprint,
  AiToneGroup,
  AiToneRewriteResult,
  AiToneRuleItem,
  AiToneStructure,
} from "@/types/ai-tone";
import { cn } from "@/lib/utils";

const MAX_CHARS = 8000;
const MIN_HANZI = 50;

const SAMPLE_TEXT = `数字化转型并不是一次简单的系统升级，而是组织能力、流程与文化同时变化的过程。一句话总结：真正决定转型成败的，是管理者能否持续投入。

对于中小企业来说，预算、人才、数据基础三个方面往往同时受限。然而，很多团队仍然把注意力放在工具选型上。与此同时，员工也在观望：新系统到底能不能减少重复劳动？当组织规模扩大时，沟通成本会上升，流程也会变得更复杂。

很多公司采用优化、增强、提升的方式描述同一件事，却没有说明具体改变了什么。负责人说，流程、制度和工具需要一起调整。这个方案需要一个能够在不同部门之间持续运行、并且不增加管理负担的机制。

团队在招聘、培训、考核、激励和复盘上投入了大量时间，也建立了相应的记录和反馈渠道。因此，管理者需要持续观察团队在不同阶段的变化。此外，组织还需要保留足够的调整空间。`;

const LEVEL_VARIANT: Record<string, "default" | "secondary" | "warning" | "outline"> = {
  A: "default",
  B: "secondary",
  F: "warning",
  X: "outline",
  H: "outline",
};

function statusLabel(status: string): string {
  if (status === "high") return "偏离参考";
  if (status === "low") return "偏离参考";
  if (status === "ok") return "参考区间内";
  return "样本不足";
}

function formatValue(item: AiToneStructure): string {
  if (item.value === null || item.value === undefined) return "—";
  if (Number.isInteger(item.value)) return String(item.value);
  return item.value.toFixed(3);
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-caption text-ink-500">{label}</div>
      <div className="mt-1 text-h2 font-semibold text-ink-900">{value}</div>
      {hint ? <div className="mt-0.5 text-caption text-ink-400">{hint}</div> : null}
    </div>
  );
}

function RuleCard({ level, item }: { level: string; item: AiToneRuleItem }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={LEVEL_VARIANT[level] ?? "outline"}>{level}</Badge>
        <span className="text-small font-semibold text-ink-900">{item.name}</span>
        <span className="text-caption text-ink-500">
          {item.count} 处 · {item.density} / 千字
        </span>
      </div>
      <p className="mt-2 text-caption text-ink-500">研究参考：{item.reference}</p>
      <p className="mt-2 text-small leading-relaxed text-ink-700">{item.advice}</p>
      {item.examples.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {item.examples.map((example, index) => (
            <li
              key={`${item.id}-${example.line}-${index}`}
              className="min-w-0 rounded-md bg-muted/40 px-2.5 py-2 text-caption leading-relaxed text-ink-600"
            >
              <span className="mr-1.5 text-ink-400">第 {example.line} 行</span>
              <span className="break-words">{example.excerpt}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GroupBlock({ group }: { group: AiToneGroup }) {
  if (group.items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-small text-ink-500">
        {group.title}：未发现命中项。
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={LEVEL_VARIANT[group.level] ?? "outline"}>{group.level}</Badge>
        <span className="text-small font-semibold text-ink-900">{group.title}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {group.items.map((item) => (
          <RuleCard key={item.id} level={group.level} item={item} />
        ))}
      </div>
    </div>
  );
}

function FingerprintRow({ item }: { item: AiToneFingerprint }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small font-medium text-ink-900">{item.label}</span>
          {item.status === "high" ? (
            <Badge variant="warning">优先检查</Badge>
          ) : item.status === "ok" ? (
            <Badge variant="success">正常</Badge>
          ) : (
            <Badge variant="outline">仅参考</Badge>
          )}
        </div>
        <p className="mt-1 text-caption text-ink-500">{item.note}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-small font-semibold text-ink-900">{item.density}</div>
        <div className="text-caption text-ink-400">/ 千字</div>
      </div>
    </div>
  );
}

export function AiToneTool() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [mounted, setMounted] = useState(false);
  const { data: quotaData } = useQuota(mounted && isAuthenticated);
  const quota = quotaData?.quotas?.ai_tone;

  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<AiToneAnalysis | null>(null);
  const [result, setResult] = useState<AiToneRewriteResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const hanziCount = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const overLimit = text.length > MAX_CHARS;
  const tooShort = hanziCount < MIN_HANZI;
  const canAnalyze = !isAnalyzing && !overLimit && !tooShort;

  const resetReport = () => {
    setAnalysis(null);
    setResult(null);
  };

  const handleTextChange = (value: string) => {
    setText(value);
    resetReport();
  };

  const handleAnalyze = async () => {
    if (tooShort) {
      toast.error(`请至少输入 ${MIN_HANZI} 个汉字`);
      return;
    }
    if (overLimit) {
      toast.error(`单次最多检测 ${MAX_CHARS} 字，请分段处理`);
      return;
    }
    setIsAnalyzing(true);
    try {
      const data = await aiToneApi.analyze(text);
      setAnalysis(data);
      setResult(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "检测失败，请重试");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRewrite = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent("/learn/tools/ai-tone")}`);
      return;
    }
    if (quota && quota.remaining <= 0) {
      toast.error("本周改写次数已用完，可在服务价格页查看套餐");
      return;
    }
    setIsRewriting(true);
    try {
      const data = await aiToneApi.rewrite(text);
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: ["quota"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "改写失败，请重试");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link href="/learn">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回小课堂
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Badge variant="secondary">免费工具</Badge>
          <h1 className="mt-3 text-balance text-h1 font-semibold tracking-tight text-ink-900">
            文字体检 · 去 AI 味
          </h1>
          <p className="mt-2 max-w-2xl text-body leading-relaxed text-ink-600">
            粘贴一段论文或文章，先看可定位的写作痕迹与结构提示，再决定要不要按建议做最小改写。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-caption text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            不保存文本
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ScanLine className="h-4 w-4" />
            单次最多 {MAX_CHARS} 字
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-h3">粘贴文本</CardTitle>
            <CardDescription>
              建议一次粘贴一个章节或 1000–3000 字，结构指标会更稳定。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={text}
              onChange={(event) => handleTextChange(event.target.value)}
              placeholder="把需要检查的论文段落、文章或报告粘贴到这里…"
              className="min-h-[260px] resize-y leading-relaxed"
              maxLength={MAX_CHARS + 500}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-caption text-ink-500">
                <span className={cn(overLimit && "text-destructive")}>
                  {text.length} / {MAX_CHARS} 字
                </span>
                <span className="mx-1.5">·</span>
                <span className={cn(tooShort && text.length > 0 && "text-warning")}>
                  汉字 {hanziCount}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTextChange(SAMPLE_TEXT)}
                >
                  填入示例
                </Button>
                <Button type="button" size="sm" onClick={handleAnalyze} disabled={!canAnalyze}>
                  {isAnalyzing ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <ScanLine className="mr-1.5 h-4 w-4" />
                  )}
                  {isAnalyzing ? "检测中…" : "开始检测"}
                </Button>
              </div>
            </div>
            <p className="text-caption leading-relaxed text-ink-400">
              文本只用于本次检测，不写入数据库。改写会调用大模型，请勿粘贴不适合发送给第三方模型的内容。
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-h3">检测口径</CardTitle>
            <CardDescription>先报告，后改写；不确定的项默认保留。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-small text-ink-600">
            <div className="space-y-3">
              <div className="flex gap-2.5">
                <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-ink-900">规则层</div>
                  <p className="mt-0.5 leading-relaxed">
                    对举句式、提示语冒号、句首连接词、顿号并列、过长定语等可定位写法。
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-ink-900">结构层</div>
                  <p className="mt-0.5 leading-relaxed">
                    句长离散度、小标题密度、相邻句同构等整篇指标，只提示，不逐句改。
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-ink-900">语义层</div>
                  <p className="mt-0.5 leading-relaxed">
                    改写时复核同义重命名、衔接连环、结论提示冒号与高度同构三连。
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-md border border-warning/25 bg-warning/5 p-3 text-caption leading-relaxed text-ink-600">
              <div className="flex items-center gap-1.5 font-medium text-ink-900">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                使用边界
              </div>
              <p className="mt-1">
                本工具不判断文章是否由 AI 写成，也不承诺通过任何检测。仅用于改善表达；
                不得用于规避学术诚信审查。AI 参与改写的部分，请按学校或期刊要求声明。
              </p>
            </div>
            <p className="text-caption leading-relaxed text-ink-400">
              检测口径参考公开的人机写作对照研究；本工具为独立实现，未复用其源码与文案。
            </p>
          </CardContent>
        </Card>
      </div>

      {analysis ? (
        <div className="mt-10 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="汉字" value={analysis.meta.hanzi} hint={`${analysis.meta.chars} 字符`} />
            <Stat label="段落" value={analysis.meta.paragraphs} hint={`${analysis.meta.sentences} 句`} />
            <Stat label="可处理项" value={analysis.summary.actionable} hint="规则与标点命中" />
            <Stat label="结构提示" value={analysis.summary.structure_flags} hint="整篇分布偏离" />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-small font-semibold text-ink-900">
                  <Sparkles className="h-4 w-4 text-primary" />
                  下一步：按建议做最小改写
                </div>
                <p className="mt-1 text-caption leading-relaxed text-ink-500">
                  只处理报告列出的项，保留事实、数字、引语与段落结构。改写后会自动复测。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mounted && isAuthenticated && quota ? (
                  <span className="text-caption text-ink-500">
                    本周剩余 {quota.remaining}/{quota.limit}
                  </span>
                ) : null}
                {mounted && !isAuthenticated ? (
                  <Button type="button" size="sm" onClick={handleRewrite}>
                    <Lock className="mr-1.5 h-4 w-4" />
                    登录后改写
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRewrite}
                    disabled={isRewriting || (!!quota && quota.remaining <= 0)}
                  >
                    {isRewriting ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-4 w-4" />
                    )}
                    {isRewriting ? "改写中…" : "按建议改写"}
                  </Button>
                )}
                {mounted && isAuthenticated && quota && quota.remaining <= 0 ? (
                  <Button variant="link" size="sm" asChild>
                    <Link href="/pricing">查看服务价格</Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            {analysis.groups.map((group) => (
              <GroupBlock key={group.level} group={group} />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-h3">结构提示</CardTitle>
                <CardDescription>整篇分布指标，只提示，不逐句处理。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {analysis.structure.map((item) => (
                  <div key={item.key} className="rounded-md border border-border px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-small font-medium text-ink-900">{item.label}</span>
                        <Badge
                          variant={
                            item.status === "high" || item.status === "low"
                              ? "warning"
                              : item.status === "ok"
                                ? "success"
                                : "outline"
                          }
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </div>
                      <div className="text-small font-semibold text-ink-900">
                        {item.status === "unknown" ? "—" : formatValue(item)}
                      </div>
                    </div>
                    <p className="mt-1 text-caption text-ink-500">
                      参考：{item.reference} · {item.note}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-h3">标点指纹</CardTitle>
                <CardDescription>不同模型的标点偏好，不据此推断文章来源。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {analysis.fingerprints.map((item) => (
                  <FingerprintRow key={item.key} item={item} />
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-h3">保持不变</CardTitle>
              <CardDescription>
                已否决项与人审项默认不改；列出来是为了避免误改。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.keep.every((group) => group.items.length === 0) ? (
                <div className="rounded-md border border-dashed border-border p-4 text-small text-ink-500">
                  未命中已否决项或需人工判断的项。
                </div>
              ) : (
                analysis.keep.map((group) => (
                  <details key={group.level} className="rounded-md border border-border p-3">
                    <summary className="cursor-pointer text-small font-medium text-ink-900">
                      {group.title}（{group.items.reduce((sum, item) => sum + item.count, 0)} 处）
                    </summary>
                    <div className="mt-3 space-y-2">
                      {group.items.map((item) => (
                        <div key={item.id} className="rounded-md bg-muted/40 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{group.level}</Badge>
                            <span className="text-small font-medium text-ink-900">{item.name}</span>
                            <span className="text-caption text-ink-500">{item.count} 处</span>
                          </div>
                          <p className="mt-1.5 text-caption leading-relaxed text-ink-600">
                            {item.advice}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {result ? (
        <div ref={resultRef} className="mt-10 space-y-6 scroll-mt-24">
          <Card className="min-w-0 border-primary/25">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-h3">改写结果</CardTitle>
                  </div>
                  <CardDescription className="mt-1">
                    改写前可处理项 {result.before.summary.actionable} → 改写后{" "}
                    {result.after.summary.actionable}
                    <span className="mx-1.5">·</span>
                    结构提示 {result.before.summary.structure_flags} →{" "}
                    {result.after.summary.structure_flags}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(result.text)}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    复制改写稿
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTextChange(result.text)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    以改写稿再检测
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border bg-cream-surface/50 p-4">
                <p className="whitespace-pre-wrap break-words text-body leading-relaxed text-ink-700">
                  {result.text}
                </p>
              </div>

              {result.semantic_issues.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-small font-semibold text-ink-900">
                    语义层复核（{result.semantic_issues.length}）
                  </div>
                  {result.semantic_issues.map((issue, index) => (
                    <div
                      key={`${issue.type}-${index}`}
                      className="rounded-md border border-border px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{issue.label}</Badge>
                        <span className="text-caption text-ink-500">{issue.reason}</span>
                      </div>
                      <p className="mt-1 break-words text-caption text-ink-600">{issue.excerpt}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {result.changes.length > 0 ? (
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-small font-medium text-ink-900">
                    逐条改动（{result.changes.length}）
                  </summary>
                  <div className="mt-3 space-y-2">
                    {result.changes.map((change, index) => (
                      <div key={index} className="rounded-md bg-muted/40 p-3 text-caption">
                        <div className="text-ink-400">{change.rule || "改写"}</div>
                        <p className="mt-1 break-words text-ink-500 line-through decoration-destructive/40">
                          {change.before}
                        </p>
                        <p className="mt-1 break-words text-ink-800">{change.after}</p>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

              <div className="flex items-start gap-2 rounded-md bg-warning/5 p-3 text-caption text-ink-600">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>{result.disclaimer}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
