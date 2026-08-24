"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";

import { adminApi } from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from "lucide-react";

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => adminApi.getUser(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="text-sm text-red-600">加载失败或数据为空。</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-ink-900">
          <ArrowLeft className="mr-1 inline h-4 w-4" />返回用户列表
        </Link>
      </div>

      <div className="rounded-lg border p-5">
        <h2 className="text-lg font-bold text-ink-900">{data?.nickname ?? "用户"}</h2>
        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground">邮箱：</span>
            <span>{data.email ?? "-"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground">套餐：</span>
            <span>{data.plan}</span>
            {data.plan_expires_at && (
              <span className="text-muted-foreground">
                至 {new Date(data.plan_expires_at).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-muted-foreground">状态：</span>
            {data.disabled ? (
              <Badge variant="destructive">已禁用</Badge>
            ) : (
              <Badge variant="secondary">正常</Badge>
            )}
            {data.is_admin && <Badge>管理员</Badge>}
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground">注册时间：</span>
            <span>{data.created_at ? new Date(data.created_at).toLocaleString() : "-"}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-base font-semibold text-ink-900">
          项目（{data.projects?.length ?? 0}）
        </h3>
        {data.projects && data.projects.length > 0 ? (
          <div className="space-y-2">
            {data.projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    状态 {p.status} · 模式 {p.mode}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无项目</p>
        )}
      </div>
    </div>
  );
}