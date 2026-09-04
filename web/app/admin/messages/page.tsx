"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MessageSquare, Copy, Check } from "lucide-react";

import { adminApi, type AdminMessage } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";

const TAG_OPTIONS = [
  { value: "presale", label: "售前咨询" },
  { value: "rescue", label: "报告救急" },
  { value: "service", label: "人工服务" },
  { value: "incident", label: "故障反馈" },
  { value: "feedback", label: "产品建议" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "待处理" },
  { value: "processing", label: "处理中" },
  { value: "done", label: "已处理" },
];

const DATA_SOURCE_OPTIONS = [
  { value: "real", label: "真实数据" },
  { value: "simulation", label: "模拟数据" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function AdminMessagesPage() {
  const queryClient = useQueryClient();

  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dsFilter, setDsFilter] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [filters, setFilters] = useState({
    tag: "",
    status: "",
    data_source: "",
    keyword: "",
  });
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<AdminMessage | null>(null);
  const [editStatus, setEditStatus] = useState<"pending" | "processing" | "done">(
    "pending"
  );
  const [editRemark, setEditRemark] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-messages", filters, page],
    queryFn: () =>
      adminApi.listMessages({
        ...(filters.tag ? { tag: filters.tag } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.data_source ? { data_source: filters.data_source } : {}),
        ...(filters.keyword ? { keyword: filters.keyword } : {}),
        page,
        page_size: 20,
      }),
  });

  const mutation = useMutation({
    mutationFn: (m: AdminMessage) =>
      adminApi.updateMessageStatus(m.id, {
        status: editStatus,
        handle_remark: editRemark.trim() || null,
      }),
    onSuccess: (updated) => {
      toast.success(`留言已标记为「${updated.status_label}」`);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
    },
    onError: () => toast.error("更新失败，请重试"),
  });

  // ── 批量处理 ─────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState<"processing" | "done">("done");

  const batchMutation = useMutation({
    mutationFn: (body: {
      message_ids: string[];
      status: "processing" | "done";
    }) => adminApi.batchUpdateMessageStatus(body),
    onSuccess: (res) => {
      toast.success(`已批量更新 ${res.updated} 条留言`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
    },
    onError: () => toast.error("批量更新失败，请重试"),
  });

  const allOnPageSelected =
    !!data && data.items.length > 0 && data.items.every((m) => selectedIds.has(m.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (allOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.items.map((m) => m.id)));
    }
  };

  const openEdit = (m: AdminMessage) => {
    setEditing(m);
    setEditStatus(m.status);
    setEditRemark(m.handle_remark ?? "");
  };

  const applyFilters = () => {
    setFilters({
      tag: tagFilter === "__all__" ? "" : tagFilter,
      status: statusFilter === "__all__" ? "" : statusFilter,
      data_source: dsFilter === "__all__" ? "" : dsFilter,
      keyword: keywordInput.trim(),
    });
    setPage(1);
  };

  const clearFilters = () => {
    setTagFilter("");
    setStatusFilter("");
    setDsFilter("");
    setKeywordInput("");
    setFilters({ tag: "", status: "", data_source: "", keyword: "" });
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ink-900">留言管理</h2>
        <p className="text-sm text-muted-foreground">
          查看用户留言、按分类筛选、标记处理状态（售后工单，写审计日志留痕）
        </p>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部分类</SelectItem>
            {TAG_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dsFilter} onValueChange={setDsFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="数据源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部数据源</SelectItem>
            {DATA_SOURCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="搜索内容 / 联系方式 / 邮箱"
          className="max-w-[240px] h-9"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />
        <Button variant="outline" size="sm" className="h-9" onClick={applyFilters}>
          筛选
        </Button>
        <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
          清除
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      )}
      {isError && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          加载失败，请确认有管理员权限。
        </p>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-ink-300" />
          <p className="mt-2 text-sm text-muted-foreground">暂无留言</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-cream-surface/60 px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAll}
                />
                本页全选（{selectedIds.size} 已选）
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Select value={batchStatus} onValueChange={(v) => setBatchStatus(v as "processing" | "done")}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="done">标记为已处理</SelectItem>
                  <SelectItem value="processing">标记为处理中</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={selectedIds.size === 0 || batchMutation.isPending}
                onClick={() =>
                  batchMutation.mutate({
                    message_ids: Array.from(selectedIds),
                    status: batchStatus,
                  })
                }
              >
                {batchMutation.isPending && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                批量{ batchStatus === "done" ? "完成" : "处理中"}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-cream-surface text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="全选本页"
                  />
                </th>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">分类</th>
                <th className="px-3 py-2">用户</th>
                <th className="px-3 py-2">联系方式</th>
                <th className="px-3 py-2">留言内容</th>
                <th className="px-3 py-2">数据源</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id} className="border-t hover:bg-accent/40 align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      aria-label="选择该留言"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {m.created_at ? new Date(m.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {m.tag_label}
                    </code>
                  </td>
                  <td className="px-3 py-2 max-w-[180px]">
                    <div className="truncate text-xs">
                      {m.user_nickname || "-"}
                    </div>
                    {m.user_email ? (
                      <div className="truncate text-xs text-muted-foreground">
                        <CopyCell value={m.user_email} />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {m.contact ? (
                      <CopyCell value={m.contact} />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <pre className="max-w-[260px] whitespace-pre-wrap break-words">
                      {m.content}
                    </pre>
                    {m.entry_point && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        入口：{m.entry_point}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {m.data_source_label || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[m.status] ?? ""}`}
                    >
                      {m.status_label}
                    </span>
                    {m.handle_remark && (
                      <div className="mt-1 max-w-[140px] truncate text-xs text-muted-foreground">
                        备注：{m.handle_remark}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                      处理
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {data.total} 条，第 {data.page} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page * data.page_size >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 处理留言弹窗 */}
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>处理留言</DialogTitle>
            <DialogDescription>更新处理状态并填写跟进备注（操作会写入审计日志）。</DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    {editing.tag_label}
                  </span>
                  <span className="text-muted-foreground">
                    {editing.user_email || editing.user_nickname || "匿名用户"}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words">{editing.content}</p>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  处理状态
                </label>
                <Select
                  value={editStatus}
                  onValueChange={(v) =>
                    setEditStatus(v as "pending" | "processing" | "done")
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  处理备注
                </label>
                <Textarea
                  rows={3}
                  placeholder="记录跟进情况，例如：已回复用户邮箱，等待补充问卷"
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              disabled={mutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={() => editing && mutation.mutate(editing)}
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 可复制单元格：显示值 + 一键复制按钮（含短暂"已复制"反馈） */
function CopyCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败
    }
  };

  return (
    <div className="flex items-center gap-1">
      <span className="max-w-[120px] truncate" title={value}>
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-muted-foreground hover:text-ink-900"
        aria-label={`复制 ${value}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}