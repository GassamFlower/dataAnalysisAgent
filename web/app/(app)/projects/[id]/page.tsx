"use client";

import Link from "next/link";
import { Lock, ArrowRight, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";
import { ProjectStatusCard } from "@/components/common/project-status-card";
import { StepNav } from "@/components/layout/step-nav";
import { QuestionTable } from "@/components/questionnaire/question-table";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/ui/toaster";
import { useProject } from "@/lib/hooks/use-project";
import { useQuestionnaire, useUpdateQuestion } from "@/lib/hooks/use-questionnaire";
import { PRICING } from "@/lib/constants";

export default function WorkbenchPage({
  params,
}: {
  params: { id: string };
}) {
  // 接入真实数据 hooks
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(params.id);
  const { data: questionnaire, isLoading: questionnaireLoading, error: questionnaireError } = useQuestionnaire(params.id);
  const updateQuestionMutation = useUpdateQuestion();

  const isLoading = projectLoading || questionnaireLoading;
  const error = projectError || questionnaireError;
  const questions = questionnaire?.structure?.questions ?? [];
  const dimensions = questionnaire?.structure?.dimensions ?? [];
  const reverseCount = questions.filter(q => q.isReverse).length;

  /** 更新单题（维度 / 反向题） */
  const handleUpdateQuestion = ({
    questionIndex,
    updates,
  }: {
    questionIndex: number;
    updates: { dimension?: string; isReverse?: boolean };
  }) => {
    updateQuestionMutation.mutate(
      {
        projectId: params.id,
        questionIndex,
        ...updates,
      },
      {
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "更新失败，请重试");
        },
      }
    );
  };

  // 正在更新的题目 index（用于禁用控件）
  const updatingIndex = updateQuestionMutation.isPending
    ? updateQuestionMutation.variables?.questionIndex ?? null
    : null;

  // Loading 状态
  if (isLoading) {
    return (
      <div>
        <StepNav projectId={params.id} current="inspect" />
        <LoadingState label="正在加载体检数据..." />
      </div>
    );
  }

  // Error 状态
  if (error) {
    return (
      <div>
        <StepNav projectId={params.id} current="inspect" />
        <ErrorState
          title="加载失败"
          message={error.message || "无法获取体检数据，请稍后重试"}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // 空数据状态（未体检）
  if (questions.length === 0) {
    return (
      <div>
        <StepNav projectId={params.id} current="inspect" />
        <PageHeader
          title="题目体检"
          description="上传题目文本，识别题型、维度归属与反向题。"
        />
        <EmptyState
          title="暂无体检数据"
          description="请先在新建项目页面粘贴题目文本或上传 .docx / .txt 文件进行体检"
          action={
            <Button asChild>
              <Link href="/projects/new">去上传题目</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <StepNav projectId={params.id} current="inspect" />

      <PageHeader
        title={project ? project.name : "题目体检"}
        description="识别题型、维度归属与反向题。免费层止步于此，付费解锁数据预演。"
      />

      {project ? <ProjectStatusCard project={project} /> : null}

      <Card className="mb-6 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
            ✓
          </div>
          <div>
            <h3 className="text-h3 font-semibold text-ink-900">体检完成</h3>
            <p className="text-body text-ink-500">
              共识别 {questions.length} 道题，{dimensions.length} 个维度，{reverseCount} 道反向题。
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-h3 font-semibold text-ink-900">维度归属表</h3>
          <Badge variant="outline" className="font-normal text-ink-500">
            <Pencil className="mr-1 h-3 w-3" />
            可编辑
          </Badge>
        </div>
        <p className="mb-3 text-body text-ink-500">
          AI 识别可能有误，点击维度下拉或反向题徽章可直接修正。
        </p>
        <QuestionTable
          questions={questions}
          dimensions={dimensions}
          onUpdateQuestion={handleUpdateQuestion}
          updatingIndex={updatingIndex}
        />
      </div>

      {/* 免费层边界：付费解锁 */}
      <Card className="border-primary/30 bg-cream-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-h3 font-semibold text-ink-900">
                付费解锁数据预演
              </h3>
              <Badge variant="warning" className="font-normal">
                {PRICING.single.badge}
              </Badge>
            </div>
            <p className="mt-2 text-body text-ink-500">
              体检永久免费。生成模拟数据、验证假设是否达标、导出报告需付费。
            </p>
            <div className="mt-4 flex gap-3">
              <Button asChild>
                <Link href="/pricing">
                  查看定价
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/projects/${params.id}/simulate`}>
                  先预览预演界面
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
