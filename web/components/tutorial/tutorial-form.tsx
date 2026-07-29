"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TutorialArticleCreateRequest } from "@/lib/api/tutorial";

/** 教程分类选项 */
const CATEGORY_OPTIONS = [
  { value: "basics", label: "统计基础" },
  { value: "methods", label: "分析方法" },
  { value: "writing", label: "论文写作" },
] as const;

/** 表单内部值 */
export interface TutorialFormValues {
  title: string;
  slug: string;
  category: string;
  summary: string;
  content_markdown: string;
  order_index: number;
  is_published: boolean;
  cover_image: string;
}

/** 提交时回调的载荷类型（与创建接口一致，更新接口兼容） */
export type TutorialFormSubmitPayload = TutorialArticleCreateRequest;

export interface TutorialFormProps {
  /** 初始值（编辑时传入） */
  initialValues?: Partial<TutorialFormValues>;
  /** 提交回调 */
  onSubmit: (values: TutorialFormSubmitPayload) => Promise<void> | void;
  /** 提交按钮文案 */
  submitLabel?: string;
  /** 提交中状态（由父组件控制） */
  submitting?: boolean;
  /** 取消回调 */
  onCancel?: () => void;
}

/** 默认值 */
const DEFAULT_VALUES: TutorialFormValues = {
  title: "",
  slug: "",
  category: "basics",
  summary: "",
  content_markdown: "",
  order_index: 100,
  is_published: false,
  cover_image: "",
};

/**
 * 从标题生成 slug（小写、连字符分隔；非 ASCII 字符会被剔除）。
 * 纯中文标题无法自动生成拼音，需用户手动填写。
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 教程表单（新建 / 编辑共享）。
 * 受控组件实现，slug 会随标题自动生成（用户手动编辑后停止跟随）。
 */
export function TutorialForm({
  initialValues,
  onSubmit,
  submitLabel = "保存",
  submitting = false,
  onCancel,
}: TutorialFormProps) {
  const [values, setValues] = useState<TutorialFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  });
  // 用户是否手动编辑过 slug（编辑过则不再随标题自动生成）
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues?.slug));
  const [errors, setErrors] = useState<
    Partial<Record<keyof TutorialFormValues, string>>
  >({});

  /** 通用字段更新 */
  function update<K extends keyof TutorialFormValues>(
    field: K,
    value: TutorialFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  /** 标题变化：同步自动生成 slug（未手动编辑过时） */
  function handleTitleChange(title: string) {
    setValues((prev) => {
      const next: TutorialFormValues = { ...prev, title };
      if (!slugTouched) {
        next.slug = generateSlug(title);
      }
      return next;
    });
    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
    if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof TutorialFormValues, string>> = {};
    if (!values.title.trim()) nextErrors.title = "请输入标题";
    if (!values.slug.trim()) nextErrors.slug = "请输入 URL 标识";
    if (!values.content_markdown.trim())
      nextErrors.content_markdown = "请输入正文内容";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: TutorialFormSubmitPayload = {
      title: values.title.trim(),
      slug: values.slug.trim(),
      category: values.category,
      content_markdown: values.content_markdown,
      summary: values.summary.trim() || undefined,
      cover_image: values.cover_image.trim() || undefined,
      order_index: Number.isNaN(values.order_index) ? 100 : values.order_index,
      is_published: values.is_published,
    };
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="space-y-5 p-6">
        {/* 标题 */}
        <div className="space-y-2">
          <Label htmlFor="tutorial-title">
            标题 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tutorial-title"
            value={values.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="例如：什么是信度与效度"
            disabled={submitting}
            aria-invalid={!!errors.title}
          />
          {errors.title ? (
            <p className="text-caption text-destructive">{errors.title}</p>
          ) : null}
        </div>

        {/* Slug */}
        <div className="space-y-2">
          <Label htmlFor="tutorial-slug">
            URL 标识 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tutorial-slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update("slug", e.target.value);
            }}
            placeholder="reliability-and-validity"
            disabled={submitting}
            aria-invalid={!!errors.slug}
          />
          {errors.slug ? (
            <p className="text-caption text-destructive">{errors.slug}</p>
          ) : (
            <p className="text-caption text-ink-400">
              访问路径 /learn/{values.slug || "..."}
            </p>
          )}
        </div>

        {/* 分类 + 排序 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tutorial-category">分类</Label>
            <Select
              value={values.category}
              onValueChange={(v) => update("category", v)}
              disabled={submitting}
            >
              <SelectTrigger id="tutorial-category">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tutorial-order">排序</Label>
            <Input
              id="tutorial-order"
              type="number"
              value={values.order_index}
              onChange={(e) => update("order_index", Number(e.target.value))}
              disabled={submitting}
            />
          </div>
        </div>

        {/* 摘要 */}
        <div className="space-y-2">
          <Label htmlFor="tutorial-summary">摘要</Label>
          <Textarea
            id="tutorial-summary"
            value={values.summary}
            onChange={(e) => update("summary", e.target.value)}
            placeholder="一句话概括本文要点（可选）"
            rows={3}
            disabled={submitting}
          />
        </div>

        {/* 封面图 */}
        <div className="space-y-2">
          <Label htmlFor="tutorial-cover">封面图 URL</Label>
          <Input
            id="tutorial-cover"
            value={values.cover_image}
            onChange={(e) => update("cover_image", e.target.value)}
            placeholder="https://...（可选）"
            disabled={submitting}
          />
        </div>

        {/* 发布开关 */}
        <div className="flex items-center justify-between rounded-md border border-border bg-cream-surface/50 px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="tutorial-published">发布</Label>
            <p className="text-caption text-ink-500">
              开启后该教程对所有用户可见
            </p>
          </div>
          <Switch
            id="tutorial-published"
            checked={values.is_published}
            onCheckedChange={(v) => update("is_published", v)}
            disabled={submitting}
          />
        </div>
      </Card>

      {/* 正文 */}
      <Card className="space-y-2 p-6">
        <Label htmlFor="tutorial-content">
          正文（Markdown） <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="tutorial-content"
          value={values.content_markdown}
          onChange={(e) => update("content_markdown", e.target.value)}
          placeholder="支持 Markdown 语法..."
          rows={16}
          disabled={submitting}
          className="font-mono text-sm"
          aria-invalid={!!errors.content_markdown}
        />
        {errors.content_markdown ? (
          <p className="text-caption text-destructive">
            {errors.content_markdown}
          </p>
        ) : null}
      </Card>

      {/* 操作 */}
      <div className="flex justify-end gap-3">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
