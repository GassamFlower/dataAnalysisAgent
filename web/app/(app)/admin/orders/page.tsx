"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const STATUS = [
  { value: "", label: "全部状态" },
  { value: "pending", label: "待支付" },
  { value: "paid", label: "已支付" },
  { value: "refunded", label: "已退款" },
  { value: "cancelled", label: "已取消" },
];

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  paid: "default",
  refunded: "secondary",
  cancelled: "destructive",
};

export default function AdminOrdersPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-orders", status, page],
    queryFn: () =>
      adminApi.listOrders({ status: status || undefined, page, page_size: 20 }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ink-900">订单与支付管理</h2>
        <p className="text-sm text-muted-foreground">
          全局订单查询与对账（F-ADM-002）
        </p>
      </div>

      <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="全部状态" />
        </SelectTrigger>
        <SelectContent>
          {STATUS.map((s) => (
            <SelectItem key={s.value || "all"} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
                <th className="px-3 py-2">订单ID</th>
                <th className="px-3 py-2">用户邮箱</th>
                <th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">金额</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{o.user_email ?? "-"}</td>
                  <td className="px-3 py-2">{o.type}</td>
                  <td className="px-3 py-2">¥{o.amount}</td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_BADGE[o.status] ?? "outline"}>{o.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {data.total} 笔，第 {data.page} 页
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