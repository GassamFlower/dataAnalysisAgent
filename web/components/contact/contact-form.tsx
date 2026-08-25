"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { useSubmitMessage } from "@/lib/hooks/use-message";
import { useAuthStore } from "@/lib/stores/auth-store";
import type {
  MessageDataSource,
  MessageTag,
} from "@/types/message";

/* ------------------------------------------------------------------ */
/* 五类留言模板配置（对齐立项文档 §4.3）                                 */
/* ------------------------------------------------------------------ */

interface TagMeta {
  label: string;
  desc: string;
  intro: string;
  /** 展示配置：section 用于前后分组，同组并列展示；组名仅供参考 */
  fields: FieldDef[];
  /** 必填字段（提交前校验） */
  required: string[];
}

type FieldType =
  | "text"
  | "select"
  | "checkbox"
  | "radio"
  | "textarea"
  | "static";

interface FieldDef {
  key: string;
  type: FieldType;
  label?: string;
  options?: string[];
  placeholder?: string;
  suffix?: string;
}

export const CONTACT_TAGS: { value: MessageTag; label: string; desc: string }[] = [
  { value: "presale", label: "售前咨询", desc: "想先试预演/体检/样本量" },
  { value: "rescue", label: "数据分析救急", desc: "分析出问题，需要帮助" },
  { value: "service", label: "专业服务询价", desc: "了解人工分析服务" },
  { value: "incident", label: "导出/支付/故障", desc: "遇到使用问题" },
  { value: "feedback", label: "投诉反馈", desc: "我要提意见" },
];

const TAG_META: Record<MessageTag, TagMeta> = {
  presale: {
    label: "售前咨询",
    desc: "想先试一下功能",
    intro: "我还在设计问卷，想先试一下【预演/体检/样本量】功能。",
    required: ["major"],
    fields: [
      { key: "scene", type: "static", label: "场景" },
      { key: "major", type: "text", label: "我的专业", placeholder: "例如：心理学 / 教育学" },
      { key: "qtype", type: "select", label: "问卷类型", options: ["量表", "社会调查", "其他"] },
      { key: "sampleSize", type: "text", label: "计划样本量", placeholder: "例如：300", suffix: "份" },
      { key: "interest", type: "checkbox", label: "想了解", options: ["免费额度", "订阅", "人工服务价格"] },
    ],
  },
  rescue: {
    label: "数据分析救急",
    desc: "分析出问题，需要帮助",
    intro: "我的数据分析出问题了，需要帮助。",
    required: ["issue"],
    fields: [
      { key: "projectId", type: "static", label: "关联项目ID" },
      { key: "dataSource", type: "static", label: "数据源" },
      { key: "issue", type: "select", label: "具体问题", options: ["信效度不达标", "相关不显著", "差异检验失败", "样本量不足", "不知道用什么方法", "其他"] },
      { key: "deadline", type: "text", label: "交稿/答辩时间", placeholder: "例如：2026 年 12 月" },
      { key: "wantService", type: "checkbox", label: "是否愿意转人工服务", options: ["是，可以转人工分析"] },
    ],
  },
  service: {
    label: "专业服务询价",
    desc: "了解人工分析服务",
    intro: "想了解人工数据分析服务。",
    required: ["major", "need"],
    fields: [
      { key: "scene", type: "static", label: "场景" },
      { key: "major", type: "text", label: "我的专业", placeholder: "例如：管理学 / 市场营销" },
      { key: "need", type: "select", label: "需要", options: ["问卷设计", "数据分析", "报告撰写", "结果不达标优化", "其他"] },
      { key: "deliver", type: "select", label: "期望交付", options: ["报告", "数据表格", "论文段落"] },
      { key: "budget", type: "text", label: "预算区间", placeholder: "例如：200-500 元" },
      { key: "contact", type: "text", label: "联系方式", placeholder: "微信 / 邮箱（便于回访）" },
    ],
  },
  incident: {
    label: "导出/支付/故障",
    desc: "遇到使用问题",
    intro: "遇到使用问题。",
    required: ["type"],
    fields: [
      { key: "projectId", type: "static", label: "关联项目ID（如有）" },
      { key: "type", type: "select", label: "问题类型", options: ["导出失败", "支付未到账", "配额未更新", "页面报错", "其他"] },
      { key: "detail", type: "textarea", label: "报错信息或说明", placeholder: "请描述具体现象与期望结果" },
    ],
  },
  feedback: {
    label: "投诉反馈",
    desc: "我要提意见",
    intro: "我要提意见。",
    required: ["satisfaction"],
    fields: [
      { key: "satisfaction", type: "radio", label: "满意度", options: ["1", "2", "3", "4", "5"] },
      { key: "painPoint", type: "textarea", label: "不满意的点", placeholder: "请描述让你不满意的具体内容" },
      { key: "improvement", type: "text", label: "期望改进", placeholder: "希望我们怎么改进" },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* 内容拼装（填空式 → 后台可读文本）                                     */
/* ------------------------------------------------------------------ */

type Values = Record<string, string>;
type Multi = Record<string, string[]>;

function toggleIn(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function pick(values: Values, key: string, fallback = "—"): string {
  const v = (values[key] ?? "").trim();
  return v || fallback;
}

function pickM(multi: Multi, key: string): string {
  const arr = multi[key] ?? [];
  return arr.length ? arr.join(" / ") : "—";
}

function composeContent(
  tag: MessageTag,
  values: Values,
  multi: Multi,
  projectId?: string | null,
  dataSource?: MessageDataSource | null
): Record<"content" | "contact", string> {
  const pid = (projectId ?? "").trim() || "—";
  const ds =
    dataSource === "real"
      ? "真实数据"
      : dataSource === "simulation"
      ? "模拟预演"
      : "—";

  let content: string;
  let contact = values.contact?.trim() ?? "";

  switch (tag) {
    case "presale":
      content = `我还在设计问卷，想先试一下【预演/体检/样本量】功能。\n我的专业：${pick(
        values,
        "major"
      )}\n问卷类型：${pick(values, "qtype")}\n计划样本量：${pick(
        values,
        "sampleSize"
      )} 份\n想了解：${pickM(multi, "interest")}`;
      break;
    case "rescue": {
      const lines = [
        "我的数据分析出问题了，需要帮助。",
        `关联项目ID：${pid}`,
        `数据源：${ds}`,
        `具体问题：${pick(values, "issue")}`,
        `交稿/答辩时间：${pick(values, "deadline")}`,
      ];
      if ((multi.wantService ?? []).length) {
        lines.push("是否愿意转人工服务：是");
      }
      content = lines.join("\n");
      break;
    }
    case "service":
      content = `想了解人工数据分析服务。\n我的专业：${pick(
        values,
        "major"
      )}\n需要：${pick(values, "need")}\n期望交付：${pick(
        values,
        "deliver"
      )}\n预算区间：${pick(values, "budget")}`;
      contact = pick(values, "contact", "");
      break;
    case "incident":
      content = `遇到使用问题。\n关联项目ID：${pid}\n问题类型：${pick(
        values,
        "type"
      )}\n报错信息或说明：${pick(values, "detail")}`;
      break;
    case "feedback":
      content = `我要提意见。\n满意度：${pick(
        values,
        "satisfaction"
      )} 分\n不满意的点：${pick(values, "painPoint")}\n期望改进：${pick(
        values,
        "improvement"
      )}`;
      break;
  }

  return { content, contact };
}

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

export interface ContactFormProps {
  defaultTag?: MessageTag;
  projectId?: string | null;
  dataSource?: MessageDataSource | null;
  entryPoint: string;
  variant?: "dialog" | "sheet";
  trigger: React.ReactNode;
}

export function ContactForm({
  defaultTag,
  projectId,
  dataSource,
  entryPoint,
  variant = "dialog",
  trigger,
}: ContactFormProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const submit = useSubmitMessage();

  const [open, setOpen] = React.useState(false);
  const [tag, setTag] = React.useState<MessageTag>(
    defaultTag ?? "presale"
  );
  const [values, setValues] = React.useState<Values>({});
  const [multi, setMulti] = React.useState<Multi>({});

  const meta = TAG_META[tag];
  const selectable = !defaultTag;

  React.useEffect(() => {
    if (defaultTag) setTag(defaultTag);
  }, [defaultTag]);

  const handleOpen = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setOpen(true);
  };

  const reset = React.useCallback(() => {
    setValues({});
    setMulti({});
  }, []);

  const setValue = (key: string, v: string) =>
    setValues((s) => ({ ...s, [key]: v }));

  const toggleMulti = (key: string, v: string) =>
    setMulti((s) => ({ ...s, [key]: toggleIn(s[key] ?? [], v) }));

  const handleTag = (next: MessageTag) => {
    setTag(next);
    reset();
  };

  const canSubmit = () => {
    if (!meta.required.every((k) => (values[k] ?? "").trim())) {
      toast.error("请补全必填项后再提交");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!canSubmit()) return;
    const { content, contact } = composeContent(
      tag,
      values,
      multi,
      projectId,
      dataSource
    );
    submit.mutate(
      {
        tag,
        content,
        project_id: projectId || undefined,
        data_source: dataSource || undefined,
        contact: contact || undefined,
        entry_point: entryPoint,
      },
      {
        onSuccess: () => {
          toast.success("留言已提交，我们会尽快跟进处理");
          reset();
          setOpen(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "提交失败，请重试");
        },
      }
    );
  };

  const renderField = (field: FieldDef) => {
    const { key: _key, type } = field;
    const id = `cf-${tag}-${_key}`;
    switch (type) {
      case "static": {
        let display = field.label ?? "";
        if (_key === "projectId") {
          display = (projectId ?? "").trim() || "（未关联项目）";
        } else if (_key === "dataSource") {
          display =
            dataSource === "real"
              ? "真实数据"
              : dataSource === "simulation"
              ? "模拟预演"
              : "（未关联）";
        }
        return (
          <div className="space-y-1">
            <Label className="text-caption text-ink-500">{field.label}</Label>
            <div className="flex h-10 items-center rounded-md border border-dashed border-border bg-ink-100/40 px-3 text-sm text-ink-600">
              {display}
            </div>
          </div>
        );
      }
      case "text":
        return (
          <div className="space-y-1.5">
            <Label htmlFor={id}>{field.label}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={id}
                value={values[_key] ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => setValue(_key, e.target.value)}
              />
              {field.suffix && (
                <span className="shrink-0 text-sm text-ink-500">
                  {field.suffix}
                </span>
              )}
            </div>
          </div>
        );
      case "textarea":
        return (
          <div className="space-y-1.5">
            <Label htmlFor={id}>{field.label}</Label>
            <Textarea
              id={id}
              value={values[_key] ?? ""}
              placeholder={field.placeholder}
              rows={3}
              onChange={(e) => setValue(_key, e.target.value)}
            />
          </div>
        );
      case "select":
        return (
          <div className="space-y-1.5">
            <Label>{field.label}</Label>
            <Select
              value={values[_key] ?? ""}
              onValueChange={(v) => setValue(_key, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "checkbox":
        return (
          <div className="space-y-1.5">
            <Label>{field.label}</Label>
            <div className="flex flex-wrap gap-3">
              {(field.options ?? []).map((o) => (
                <label
                  key={o}
                  className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-700"
                >
                  <Checkbox
                    checked={(multi[_key] ?? []).includes(o)}
                    onCheckedChange={() => toggleMulti(_key, o)}
                  />
                  {o}
                </label>
              ))}
            </div>
          </div>
        );
      case "radio":
        return (
          <div className="space-y-1.5">
            <Label>{field.label}</Label>
            <RadioGroup
              value={values[_key] ?? ""}
              onValueChange={(v) => setValue(_key, v)}
              className="flex items-center gap-4"
            >
              {(field.options ?? []).map((o) => (
                <div key={o} className="flex items-center gap-1.5">
                  <RadioGroupItem value={o} id={`${id}-${o}`} />
                  <Label htmlFor={`${id}-${o}`} className="font-normal">
                    {o} 分
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      default:
        return null;
    }
  };

  // 模板字段（跳过 static 静态展示，那些由上方救急/故障分组单独渲染）
  const formFields = meta.fields.filter((f) => f.type !== "static");

  const formBody = (
    <div className="space-y-4">
      {/* 类目切换（仅三种入口暴露时可切换类别；单一场景入口锁定类别） */}
      {selectable && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CONTACT_TAGS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTag(t.value)}
              className={cn(
                "rounded-md border px-3 py-2 text-left transition-colors",
                t.value === tag
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-ink-700 hover:border-primary/40"
              )}
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-xs text-ink-500">{t.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* 说明文案 */}
      <p className="rounded-md bg-ink-100/50 px-3 py-2 text-sm text-ink-600">
        {meta.intro}
      </p>

      {/* 自动带项目/数据源（救急/故障场景） */}
      {(tag === "rescue" || tag === "incident") && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>{renderField({ key: "projectId", type: "static", label: "关联项目ID" })}</div>
          {tag === "rescue" && (
            <div>{renderField({ key: "dataSource", type: "static", label: "数据源" })}</div>
          )}
        </div>
      )}

      {/* 模板字段 */}
      {formFields.map((f) => (
        <div key={f.key}>{renderField(f)}</div>
      ))}

      {/* 通用联系方式（选填，便于回访） */}
      <div className="space-y-1.5">
        <Label htmlFor="cf-contact">
          联系方式（选填）
          <span className="ml-1 text-xs text-ink-400">便于我们回访</span>
        </Label>
        <Input
          id="cf-contact"
          value={values.contact ?? ""}
          placeholder="微信 / 邮箱 / 手机号"
          onChange={(e) => setValue("contact", e.target.value)}
        />
      </div>
    </div>
  );

  const footer = (
    <Button onClick={handleSubmit} disabled={submit.isPending} className="w-full">
      {submit.isPending ? (
        <>
          <span className="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          提交中…
        </>
      ) : (
        <>
          <Send className="mr-1.5 h-4 w-4" />
          提交留言
        </>
      )}
    </Button>
  );

  // 注入打开逻辑的触发节点（守卫：未登录先跳登录）
  const guardedTrigger = React.isValidElement(trigger)
    ? React.cloneElement(trigger as React.ReactElement, { onClick: handleOpen })
    : trigger;

  if (variant === "sheet") {
    return (
      <>
        {guardedTrigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>留言给我们</SheetTitle>
              <SheetDescription>
                {meta.label} · 选择领域并填写，后台将按标签归类处理
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">{formBody}</div>
            <div className="mt-6">{footer}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {guardedTrigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{meta.label}</DialogTitle>
            <DialogDescription>
              {selectable ? "选择留言场景并填写，后台会按标签归类处理。" : meta.desc}
            </DialogDescription>
          </DialogHeader>
          {formBody}
          <DialogFooter className="sm:justify-center">{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}