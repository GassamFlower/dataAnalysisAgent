"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/page-header";
import { QuestionUploader } from "@/components/questionnaire/question-uploader";
import { toast } from "@/components/ui/toaster";
import { DISCLAIMER, QUESTIONNAISE_TEMPLATES } from "@/lib/constants";
import { useCreateProject } from "@/lib/hooks/use-project";
import { useParseQuestionnaire } from "@/lib/hooks/use-questionnaire";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rawText, setRawText] = useState("");

  const createProject = useCreateProject();
  const parseQuestionnaire = useParseQuestionnaire();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.warning("请输入项目名称");
      return;
    }
    if (!rawText.trim()) {
      toast.warning("请输入问卷题目");
      return;
    }

    try {
      // 1. 创建项目
      const project = await createProject.mutateAsync({ name: name.trim() });

      // 2. 体检题目
      await parseQuestionnaire.mutateAsync({
        projectId: project.id,
        rawText: rawText.trim(),
      });

      // 3. 跳转到工作台
      toast.success("项目创建成功，体检完成");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      console.error("创建失败:", err);
      toast.error(err instanceof Error ? err.message : "创建失败，请重试");
    }
  };

  const isSubmitting = createProject.isPending || parseQuestionnaire.isPending;

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/projects">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回项目列表
        </Link>
      </Button>

      <PageHeader
        title="新建项目"
        description="上传问卷题目，系统将识别题型、维度归属与反向题。"
      />

      <div className="space-y-6">
        <Card className="p-6">
          <div className="space-y-2">
            <Label htmlFor="project-name">项目名称</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：大学生学习动机与学业表现研究"
              disabled={isSubmitting}
            />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ink-500" />
            <h3 className="text-h3 font-semibold text-ink-900">示例模板</h3>
          </div>
          <p className="mt-1 text-body text-ink-500">
            不知道从何开始？点击模板一键填充项目名称与题目，可在此基础上修改。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {QUESTIONNAISE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => {
                  setName(tpl.name);
                  setRawText(tpl.rawText);
                }}
                disabled={isSubmitting}
                className="group rounded-md border border-border bg-cream-surface/50 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-cream-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-body font-medium text-ink-900">
                    {tpl.label}
                  </span>
                  <span className="rounded-full bg-cream-muted px-2 py-0.5 text-caption text-ink-500">
                    {tpl.description}
                  </span>
                </div>
                <p className="mt-1 text-caption text-ink-500 group-hover:text-ink-700">
                  {tpl.name}
                </p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-h3 font-semibold text-ink-900">问卷题目</h3>
          <p className="mt-1 text-body text-ink-500">
            粘贴题目文本或上传文档，开始免费体检。
          </p>
          <div className="mt-4">
            <QuestionUploader
              value={rawText}
              onChange={setRawText}
              disabled={isSubmitting}
            />
          </div>
        </Card>

        <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-caption text-ink-500">
          {DISCLAIMER}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            asChild
            disabled={isSubmitting}
          >
            <Link href="/projects">取消</Link>
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {createProject.isPending ? "创建中..." : "体检中..."}
              </>
            ) : (
              "创建并体检"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
