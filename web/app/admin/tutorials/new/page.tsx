"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { toast } from "@/components/ui/toaster";
import {
  TutorialForm,
  type TutorialFormSubmitPayload,
} from "@/components/tutorial/tutorial-form";
import { useCreateTutorialArticle } from "@/lib/hooks/use-tutorial";

/**
 * 新建教程页。
 * 提交后调用创建接口，成功后跳转回列表页。
 */
export default function NewTutorialPage() {
  const router = useRouter();
  const createArticle = useCreateTutorialArticle();

  async function handleSubmit(payload: TutorialFormSubmitPayload) {
    try {
      await createArticle.mutateAsync(payload);
      toast.success("教程已创建");
      router.push("/admin/tutorials");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败，请重试");
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/admin/tutorials">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回教程列表
        </Link>
      </Button>

      <div className="mb-6">
        <PageHeader title="新建教程" description="创建一篇新的统计小课堂教程。" />
      </div>

      <TutorialForm
        onSubmit={handleSubmit}
        submitting={createArticle.isPending}
        submitLabel="创建教程"
        onCancel={() => router.push("/admin/tutorials")}
      />
    </div>
  );
}
