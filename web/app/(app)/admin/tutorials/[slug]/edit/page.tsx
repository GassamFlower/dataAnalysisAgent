"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { toast } from "@/components/ui/toaster";
import {
  TutorialForm,
  type TutorialFormSubmitPayload,
} from "@/components/tutorial/tutorial-form";
import {
  useTutorialArticle,
  useUpdateTutorialArticle,
} from "@/lib/hooks/use-tutorial";

/**
 * 编辑教程页。
 *
 * 通过 slug 加载教程详情，预填表单后调用更新接口，成功后跳转回列表页。
 */
export default function EditTutorialPage({
  params,
}: {
  params: { slug: string };
}) {
  const router = useRouter();
  const { data: article, isLoading, isError, error, refetch } =
    useTutorialArticle(params.slug);
  const updateArticle = useUpdateTutorialArticle();

  async function handleSubmit(payload: TutorialFormSubmitPayload) {
    if (!article) return;
    try {
      await updateArticle.mutateAsync({ id: article.id, data: payload });
      toast.success("教程已更新");
      router.push("/admin/tutorials");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败，请重试");
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

      <PageHeader title="编辑教程" description="修改教程内容与发布状态。" />

      {isLoading ? (
        <LoadingState label="正在加载教程..." />
      ) : isError || !article ? (
        <ErrorState
          title="加载失败"
          message={error?.message || "无法获取教程详情，请稍后重试"}
          onRetry={() => refetch()}
        />
      ) : (
        <TutorialForm
          initialValues={{
            title: article.title,
            slug: article.slug,
            category: article.category,
            summary: article.summary ?? "",
            content_markdown: article.content_markdown,
            order_index: article.order_index,
            is_published: article.is_published,
            cover_image: article.cover_image ?? "",
          }}
          onSubmit={handleSubmit}
          submitting={updateArticle.isPending}
          submitLabel="保存修改"
          onCancel={() => router.push("/admin/tutorials")}
        />
      )}
    </div>
  );
}
