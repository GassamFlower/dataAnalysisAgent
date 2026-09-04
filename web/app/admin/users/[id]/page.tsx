"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { adminApi, type AdminUser } from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, ArrowLeft, Ban, Undo2, KeyRound } from "lucide-react";

const OPEN_CHANNELS = [
  { value: "xianyu", label: "咸鱼" },
  { value: "wechat", label: "微信" },
  { value: "alipay", label: "支付宝" },
  { value: "cash", label: "现金/线下" },
  { value: "other", label: "其他" },
];

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => adminApi.getUser(id),
    enabled: !!id,
  });

  const changePlan = useMutation({
    mutationFn: (v: { id: string; plan: string }) =>
      adminApi.changePlan(v.id, { plan: v.plan }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("套餐已更新");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "更新套餐失败"),
  });

  const toggleDisabled = useMutation({
    mutationFn: (v: { id: string; disabled: boolean }) =>
      adminApi.setDisabled(v.id, v.disabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("已更新账号状态");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "操作失败"),
  });

  // 线下开通弹窗
  const [openOffline, setOpenOffline] = useState(false);
  const [oPlan, setOPlan] = useState<"single" | "subscription">("single");
  const [oChannel, setOChannel] = useState("xianyu");
  const [oDays, setODays] = useState("30");
  const [oAmount, setOAmount] = useState("");
  const [oRemark, setORemark] = useState("");

  const resetOffline = () => {
    setOPlan("single");
    setOChannel("xianyu");
    setODays("30");
    setOAmount("");
    setORemark("");
  };

  const openOfflineMut = useMutation({
    mutationFn: (body: {
      user_id: string;
      plan_type: "single" | "subscription";
      days?: number;
      channel?: string;
      remark?: string;
      amount?: number;
    }) => adminApi.createOfflineOrder(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setOpenOffline(false);
      resetOffline();
      toast.success("线下开通成功，已记账并激活套餐");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "开通失败"),
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
      <div className="flex items-center justify-between">
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-ink-900">
          <ArrowLeft className="mr-1 inline h-4 w-4" />返回用户列表
        </Link>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetOffline();
              setOpenOffline(true);
            }}
          >
            <KeyRound className="mr-1 h-3 w-3" />线下开通
          </Button>
          {data.disabled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={toggleDisabled.isPending}
              onClick={() => toggleDisabled.mutate({ id: data.id, disabled: false })}
            >
              <Undo2 className="mr-1 h-3 w-3" />启用账号
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={toggleDisabled.isPending || data.is_admin}
              onClick={() => toggleDisabled.mutate({ id: data.id, disabled: true })}
            >
              <Ban className="mr-1 h-3 w-3" />禁用账号
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-5">
        <h2 className="text-lg font-bold text-ink-900">{data?.nickname ?? "用户"}</h2>
        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground">邮箱：</span>
            <span>{data.email ?? "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">套餐：</span>
            <Select
              value={data.plan}
              onValueChange={(v) => {
                if (v !== data.plan) changePlan.mutate({ id: data.id, plan: v });
              }}
            >
              <SelectTrigger className="h-8 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">免费</SelectItem>
                <SelectItem value="single">单次</SelectItem>
                <SelectItem value="subscription">订阅</SelectItem>
              </SelectContent>
            </Select>
            {data.plan_expires_at && (
              <span className="text-muted-foreground">
                到期 {new Date(data.plan_expires_at).toLocaleString("zh-CN")}
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
            {!data.email_verified && <Badge variant="outline">未验证邮箱</Badge>}
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground">注册时间：</span>
            <span>{data.created_at ? new Date(data.created_at).toLocaleString("zh-CN") : "-"}</span>
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

      {/* 线下开通弹窗 */}
      <Dialog open={openOffline} onOpenChange={setOpenOffline}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>线下开通 · {data.email ?? data.id}</DialogTitle>
            <DialogDescription>
              记录一笔「线下已支付订单」并同时激活套餐（同事务）。当前套餐：
              {data.plan}，到期 {data.plan_expires_at ? new Date(data.plan_expires_at).toLocaleDateString("zh-CN") : "无"}。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>开通类型</Label>
                <Select value={oPlan} onValueChange={(v) => setOPlan(v as "single" | "subscription")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">单次</SelectItem>
                    <SelectItem value="subscription">开通期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>成交渠道</Label>
                <Select value={oChannel} onValueChange={setOChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPEN_CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>开通天数（默认 30）</Label>
                <Input type="number" min={1} value={oDays} onChange={(e) => setODays(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>实收金额（元，留空=平台默认）</Label>
                <Input type="number" min={0} step="0.01" value={oAmount} onChange={(e) => setOAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>对账备注（如咸鱼订单号）</Label>
              <Input value={oRemark} onChange={(e) => setORemark(e.target.value)} placeholder="选填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenOffline(false)}>
              取消
            </Button>
            <Button
              disabled={openOfflineMut.isPending}
              onClick={() =>
                openOfflineMut.mutate({
                  user_id: data.id,
                  plan_type: oPlan,
                  days: oDays ? Number(oDays) : undefined,
                  channel: oChannel,
                  remark: oRemark || undefined,
                  amount: oAmount ? Number(oAmount) : undefined,
                })
              }
            >
              {openOfflineMut.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />开通中
                </>
              ) : (
                "确认开通并记账"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}