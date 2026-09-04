"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/page-header";
import { TableEmpty } from "@/components/admin/table-empty";
import { TablePagination } from "@/components/admin/table-pagination";
import { PageLoading } from "@/components/admin/loading";
import { ChevronDown, ChevronRight } from "lucide-react";

/** 常见审计操作类型（后台管理 + 关键用户动作），便于下拉预置 */
const COMMON_ACTIONS = [
  "admin_create_offline_order",
  "admin_refund_order",
  "admin_change_plan",
  "admin_toggle_disabled",
  "admin_export_users",
  "admin_update_quota_limit",
  "message_status_update",
  "payment",
];

export default function AdminAuditLogsPage() {
  const [actionType, setActionType] = useState("");
  const [userId, setUserId] = useState("");
  const [filters, setFilters] = useState({ action_type: "", user_id: "" });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-audit-logs", filters, page],
    queryFn: () =>
      adminApi.listAuditLogs({
        ...(filters.action_type ? { action_type: filters.action_type } : {}),
        ...(filters.user_id ? { user_id: filters.user_id } : {}),
        page,
        page_size: 20,
      }),
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyFilters = () => {
    setFilters({ action_type: actionType.trim(), user_id: userId.trim() });
    setPage(1);
  };

  const clearFilters = () => {
    setActionType("");
    setUserId("");
    setFilters({ action_type: "", user_id: "" });
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="审计日志"
        description="用户关键操作日志查询（F-SYS-008 / F-ADM-005），保留 1 年，管理员只读"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="常见操作（下拉预置）" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="或直接输入操作类型 / 用户 ID"
          className="max-w-[260px]"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
        />
        <Input
          placeholder="用户 ID（可选）"
          className="max-w-[200px]"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={applyFilters}>
          筛选
        </Button>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          清除
        </Button>
      </div>

      {isLoading && <PageLoading />}
      {isError && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          加载失败，请确认有管理员权限。
        </p>
      )}

      {data && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-cream-surface text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">操作类型</th>
                <th className="px-3 py-2">用户ID</th>
                <th className="px-3 py-2">详情</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <TableEmpty colSpan={5} message="暂无审计记录" hint="可尝试清除筛选条件" />
              )}
              {data.items.map((a) => {
                const isOpen = expanded.has(a.id);
                return (
                  <tr key={a.id} className="border-t align-top hover:bg-accent/40">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {a.action_type}
                      </code>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{a.user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-xs">
                      {a.action_detail && Object.keys(a.action_detail).length > 0 ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleExpand(a.id)}
                            className="mb-1 inline-flex items-center gap-1 rounded text-primary hover:underline"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            {isOpen ? "收起" : "展开"}详情
                          </button>
                          {isOpen && (
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                              {Object.entries(a.action_detail).map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                  <span className="shrink-0 text-muted-foreground">{k}:</span>
                                  <span className="break-all text-ink-700">
                                    {typeof v === "object"
                                      ? JSON.stringify(v)
                                      : String(v ?? "")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {a.ip_address ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <TablePagination
          total={data.total}
          page={data.page}
          pageSize={data.page_size}
          onPageChange={setPage}
          unit="条"
        />
      )}
    </div>
  );
}
