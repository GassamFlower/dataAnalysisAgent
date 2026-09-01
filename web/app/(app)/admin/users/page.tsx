"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";

import { adminApi, type AdminUser } from "@/lib/api/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldOff, Ban, Undo2, KeyRound } from "lucide-react";

const PLANS = [
  { value: "", label: "全部套餐" },
  { value: "free", label: "免费" },
  { value: "single", label: "单次" },
  { value: "subscription", label: "订阅" },
];

const OPEN_CHANNELS = [
  { value: "xianyu", label: "咸鱼" },
  { value: "wechat", label: "微信" },
  { value: "alipay", label: "支付宝" },
  { value: "cash", label: "现金/线下" },
  { value: "other", label: "其他" },
];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [plan, setPlan] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // 线下开通弹窗状态
  const [openUser, setOpenUser] = useState<AdminUser | null>(null);
  const [oPlan, setOPlan] = useState<"single" | "subscription">("single");
  const [oChannel, setOChannel] = useState("xianyu");
  const [oDays, setODays] = useState("30");
  const [oAmount, setOAmount] = useState("");
  const [oRemark, setORemark] = useState("");

  const resetForm = () => {
    setOPlan("single");
    setOChannel("xianyu");
    setODays("30");
    setOAmount("");
    setORemark("");
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-users", search, plan, page],
    queryFn: () =>
      adminApi.listUsers({
        keyword: search || undefined,
        plan: plan || undefined,
        page,
        page_size: 20,
      }),
  });

  const changePlan = useMutation({
    mutationFn: (v: { id: string; plan: string }) =>
      adminApi.changePlan(v.id, { plan: v.plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const toggleDisabled = useMutation({
    mutationFn: (v: { id: string; disabled: boolean }) =>
      adminApi.setDisabled(v.id, v.disabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const openOffline = useMutation({
    mutationFn: (v: {
      user_id: string;
      plan_type: "single" | "subscription";
      days?: number;
      channel?: string;
      remark?: string;
      amount?: number;
    }) => adminApi.createOfflineOrder(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setOpenUser(null);
      resetForm();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ink-900">用户与项目运营</h2>
        <p className="text-sm text-muted-foreground">
          查看用户、调整套餐、禁用/启用账号（F-ADM-001）
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="邮箱 / 昵称搜索"
          className="max-w-xs"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearch(keyword);
              setPage(1);
            }
          }}
        />
        <Button variant="outline" size="sm" onClick={() => { setSearch(keyword); setPage(1); }}>
          搜索
        </Button>
        <Select value={plan} onValueChange={(v) => { setPlan(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部套餐" />
          </SelectTrigger>
          <SelectContent>
            {PLANS.map((p) => (
              <SelectItem key={p.value || "all"} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      )}
      {isError && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          加载失败，请确认你有管理员权限。
        </p>
      )}

      {data && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-cream-surface text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">邮箱</th>
                <th className="px-3 py-2">昵称</th>
                <th className="px-3 py-2">套餐</th>
                <th className="px-3 py-2">项目</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">管理员</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u: AdminUser) => (
                <tr key={u.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/admin/users/${u.id}`} className="text-primary hover:underline">
                      {u.email ?? u.email_masked ?? u.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{u.nickname ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={u.plan}
                      onValueChange={(v) => {
                        if (v !== u.plan) changePlan.mutate({ id: u.id, plan: v });
                      }}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">免费</SelectItem>
                        <SelectItem value="single">单次</SelectItem>
                        <SelectItem value="subscription">订阅</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">{u.project_count ?? 0}</td>
                  <td className="px-3 py-2">
                    {u.disabled ? (
                      <Badge variant="destructive">已禁用</Badge>
                    ) : (
                      <Badge variant="secondary">正常</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {u.is_admin ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <ShieldOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOpenUser(u);
                          resetForm();
                        }}
                      >
                        <KeyRound className="mr-1 h-3 w-3" />开通
                      </Button>
                      {u.disabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleDisabled.isPending}
                        onClick={() => toggleDisabled.mutate({ id: u.id, disabled: false })}
                      >
                        <Undo2 className="mr-1 h-3 w-3" />启用
                      </Button>
                      ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleDisabled.isPending || u.is_admin}
                        onClick={() => toggleDisabled.mutate({ id: u.id, disabled: true })}
                      >
                        <Ban className="mr-1 h-3 w-3" />禁用
                      </Button>
                      )}
                    </div>
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
            共 {data.total} 人，第 {data.page} 页
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

      {/* 线下开通弹窗（线下成交转最小可行方案 Step 2） */}
      <Dialog
        open={openUser !== null}
        onOpenChange={(o) => {
          if (!o) setOpenUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              线下开通 · {openUser?.email ?? openUser?.email_masked ?? openUser?.id ?? ""}
            </DialogTitle>
            <DialogDescription>
              记录一笔「线下已支付订单」并同时为该用户开通套餐（同事务）。当前套餐：
              {openUser?.plan}，到期 {openUser?.plan_expires_at ? new Date(openUser.plan_expires_at).toLocaleDateString("zh-CN") : "无"}。
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
                <Input
                  type="number"
                  min={1}
                  value={oDays}
                  onChange={(e) => setODays(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>实收金额（元，留空=按平台默认）</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={oAmount}
                  onChange={(e) => setOAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>对账备注（如咸鱼订单号）</Label>
              <Input
                value={oRemark}
                onChange={(e) => setORemark(e.target.value)}
                placeholder="选填，用于后台对账"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenUser(null)}>
              取消
            </Button>
            <Button
              disabled={openOffline.isPending || !openUser}
              onClick={() => {
                if (!openUser) return;
                openOffline.mutate({
                  user_id: openUser.id,
                  plan_type: oPlan,
                  days: oDays ? Number(oDays) : undefined,
                  channel: oChannel,
                  remark: oRemark || undefined,
                  amount: oAmount ? Number(oAmount) : undefined,
                });
              }}
            >
              {openOffline.isPending ? (
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