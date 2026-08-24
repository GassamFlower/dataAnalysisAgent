"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function AdminAuditLogsPage() {
  const [actionType, setActionType] = useState("");
  const [userId, setUserId] = useState("");
  const [filters, setFilters] = useState({ action_type: "", user_id: "" });
  const [page, setPage] = useState(1);

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ink-900">审计日志</h2>
        <p className="text-sm text-muted-foreground">
          用户关键操作日志查询（F-SYS-008 / F-ADM-005），保留 1 年，管理员只读
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="操作类型，如 admin_change_plan"
          className="max-w-[220px]"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
        />
        <Input
          placeholder="用户 ID（可选）"
          className="max-w-[200px]"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFilters({ action_type: actionType.trim(), user_id: userId.trim() });
            setPage(1);
          }}
        >
          筛选
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActionType("");
            setUserId("");
            setFilters({ action_type: "", user_id: "" });
            setPage(1);
          }}
        >
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
              {data.items.map((a) => (
                <tr key={a.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {a.created_at ? new Date(a.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{a.action_type}</code>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{a.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-xs">
                    <pre className="max-w-[260px] truncate text-ellipsis">
                      {a.action_detail ? JSON.stringify(a.action_detail) : "-"}
                    </pre>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{a.ip_address ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {data.total} 条，第 {data.page} 页
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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
    </div>
  );
}