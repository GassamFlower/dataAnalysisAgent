"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserPlus, KeyRound } from "lucide-react";

import {
  adminApi,
  type AdminRole,
  type AdminModuleKey,
  type AdminUser,
} from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/admin/page-header";
import { TableEmpty } from "@/components/admin/table-empty";
import { PageLoading } from "@/components/admin/loading";
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

/** 授权期限输入：二选一（天 或 具体日期） */
type ExpiryMode = "days" | "date";

export default function AdminPermissionsPage() {
  const qc = useQueryClient();
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUser, setGrantUser] = useState<AdminUser | null>(null);
  const [grantModules, setGrantModules] = useState<AdminModuleKey[]>(["users"]);
  const [roleKey, setRoleKey] = useState("");
  const [grantMode, setGrantMode] = useState<ExpiryMode>("days");
  const [grantDays, setGrantDays] = useState("30");
  const [grantDate, setGrantDate] = useState("");

  // 更新期限详情
  const [editPerm, setEditPerm] = useState<{ user: string; module: AdminModuleKey } | null>(null);
  const [editMode, setEditMode] = useState<ExpiryMode>("days");
  const [editDays, setEditDays] = useState("30");
  const [editDate, setEditDate] = useState("");

  // 用户搜索
  const [searchKw, setSearchKw] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: () => adminApi.listPermissions(),
  });

  const { data: modulesData } = useQuery({
    queryKey: ["admin-modules"],
    queryFn: () => adminApi.listModules(),
  });

  const { data: roleTemplatesData } = useQuery({
    queryKey: ["admin-role-templates"],
    queryFn: () => adminApi.listRoleTemplates(),
  });

  const { data: userSearch } = useQuery({
    queryKey: ["admin-user-search", searchKw],
    queryFn: () =>
      adminApi.listUsers({
        keyword: searchKw || undefined,
        page: 1,
        page_size: 15,
      }),
    enabled: grantOpen && searchKw.length > 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-permissions"] });
  };

  const resetGrant = () => {
    setGrantUser(null);
    setSearchKw("");
    setSearchInput("");
    setGrantModules(["users"]);
    setRoleKey("");
    setGrantMode("days");
    setGrantDays("30");
    setGrantDate("");
  };

  /** 应用角色模板：把 preset 模块写入勾选集 */
  const applyRoleTemplate = (key: string) => {
    setRoleKey(key);
    const tmpl = roleTemplatesData?.items.find((t) => t.key === key);
    if (tmpl && tmpl.modules.length > 0) {
      setGrantModules([...tmpl.modules]);
    }
  };

  const toggleModule = (m: AdminModuleKey) => {
    setRoleKey("");
    setGrantModules((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const openEditPerm = (a: AdminRole) => {
    setEditPerm({ user: a.id, module: a.modules[0]?.module ?? "users" });
    setEditMode("days");
    setEditDays("30");
    setEditDate("");
  };

  const grant = useMutation({
    mutationFn: () =>
      adminApi.grantPermissionsBatch({
        user_id: grantUser!.id,
        modules: grantModules,
        ...(grantMode === "days"
          ? { days: grantDays ? Number(grantDays) : undefined }
          : { expires_at: grantDate || undefined }),
      }),
    onSuccess: () => {
      invalidate();
      setGrantOpen(false);
      setGrantUser(null);
      setGrantModules(["users"]);
      setRoleKey("");
      setGrantDate("");
      setGrantDays("30");
      toast.success("已授予该账号模块管理权限");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "授权失败"),
  });

  const removeAdmin = useMutation({
    mutationFn: (userId: string) => adminApi.removeAdmin(userId),
    onSuccess: () => {
      invalidate();
      toast.success("已移除该账号的管理员身份");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "移除失败"),
  });

  const updatePerm = useMutation({
    mutationFn: () =>
      adminApi.updatePermission(editPerm!.user, editPerm!.module, {
        ...(editMode === "days"
          ? { days: editDays ? Number(editDays) : undefined }
          : { expires_at: editDate || undefined }),
      }),
    onSuccess: () => {
      invalidate();
      setEditPerm(null);
      toast.success("授权期限已更新");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "更新失败"),
  });

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("zh-CN") : "—";

  return (
    <div className="space-y-4">
      <PageHeader
        title="管理员授权"
        description="把后台模块管理权限委派给其他管理员，可设置时效（F-ADM-006）"
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          超管拥有全部模块；子管理员仅可访问被勾选且未过期的模块。
        </p>
        <Button size="sm" onClick={() => { setGrantOpen(true); resetGrant(); }}>
          <UserPlus className="mr-1 h-4 w-4" />授予权限
        </Button>
      </div>

      {isLoading && <PageLoading />}
      {!isLoading && isError && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          加载失败，请确认你有超级管理员权限。
        </p>
      )}

      {data && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-cream-surface text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">账号</th>
                <th className="px-3 py-2">角色</th>
                <th className="px-3 py-2">授权模块</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <TableEmpty colSpan={4} message="暂无管理员" hint="先授予一个账号管理员权限" />
              )}
              {data.items.map((a: AdminRole) => (
                <tr key={a.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <div className="font-medium">{a.nickname || a.id}</div>
                    <div className="text-xs text-muted-foreground">{a.email ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    {a.is_super_admin ? (
                      <Badge>超管</Badge>
                    ) : (
                      <Badge variant="secondary">管理员</Badge>
                    )}
                    {a.disabled && <Badge variant="destructive">已禁用</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {a.is_super_admin ? (
                        <Badge variant="outline">全部模块</Badge>
                      ) : a.modules.length === 0 ? (
                        <span className="text-xs text-muted-foreground">无（将退回普通用户）</span>
                      ) : (
                        a.modules.map((m) => (
                          <Badge key={m.module} variant={m.active ? "default" : "outline"}>
                            {m.module_label}
                            <span className="ml-1 font-normal text-muted-foreground">
                              {m.permanent ? "长期" : `~${fmtDate(m.expires_at)}`}
                            </span>
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {!a.is_super_admin && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={a.modules.length === 0}
                            onClick={() => openEditPerm(a)}
                          >
                            <KeyRound className="mr-1 h-3 w-3" />期限
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={removeAdmin.isPending}
                            onClick={() => removeAdmin.mutate(a.id)}
                          >
                            <ShieldCheck className="mr-1 h-3 w-3" />移除管理员
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 授予权限弹窗 */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>授予后台模块权限</DialogTitle>
            <DialogDescription>
              选择目标账号、用角色模板或手动勾选一个或多个后台模块，并可指定有效天数或到期日期。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>目标账号</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="用邮箱/昵称搜索并对目标授权"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setSearchKw(searchInput); } }}
                />
                <Button variant="outline" onClick={() => setSearchKw(searchInput)}>搜索</Button>
              </div>
              {grantOpen && searchKw && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {userSearch?.items.map((u: AdminUser) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setGrantUser(u); setSearchKw(""); setSearchInput(""); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent ${grantUser?.id === u.id ? "bg-accent" : ""}`}
                    >
                      <span>{u.email ?? u.email_masked ?? u.id}</span>
                      <span className="text-xs text-muted-foreground">{u.nickname ?? "-"}</span>
                    </button>
                  ))}
                  {userSearch?.items?.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">未找到匹配账号</div>
                  )}
                </div>
              )}
              {grantUser && (
                <div className="text-sm text-muted-foreground">
                  已选：<span className="font-medium text-ink-900">{grantUser.email ?? grantUser.email_masked ?? grantUser.id}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>角色模板（一键勾选，可再改）</Label>
                <Select
                  value={roleKey || "none"}
                  onValueChange={(v) => applyRoleTemplate(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择常用角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">自定义</SelectItem>
                    {roleTemplatesData?.items.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {roleKey && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {roleTemplatesData?.items
                      .find((t) => t.key === roleKey)
                      ?.modules_label.map((l) => (
                        <Badge key={l} variant="secondary">{l}</Badge>
                      ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>已选模块（{grantModules.length}）</Label>
                <div className="rounded-md border p-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {modulesData?.items.map((m) => (
                      <label
                        key={m.module}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        <Checkbox
                          checked={grantModules.includes(m.module)}
                          onCheckedChange={() => toggleModule(m.module)}
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>授权期限</Label>
              <div className="grid grid-cols-3 items-end gap-2">
                <Select value={grantMode} onValueChange={(v) => setGrantMode(v as ExpiryMode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">按天数</SelectItem>
                    <SelectItem value="date">按到期日期</SelectItem>
                  </SelectContent>
                </Select>
                {grantMode === "days" ? (
                  <Input type="number" min={1} className="col-span-1" value={grantDays}
                    onChange={(e) => setGrantDays(e.target.value)} />
                ) : (
                  <Input type="date" className="col-span-1" value={grantDate}
                    onChange={(e) => setGrantDate(e.target.value)} />
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>取消</Button>
            <Button
              disabled={!grantUser || grantModules.length === 0 || grant.isPending}
              onClick={() => grant.mutate()}
            >
              {grant.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              确认授权
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 更新期限弹窗 */}
      <Dialog open={editPerm !== null} onOpenChange={(o) => { if (!o) setEditPerm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>更新模块授权期限</DialogTitle>
            <DialogDescription>以天数或新的到期日期重新设置（须晚于当前时间）。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>期限方式</Label>
              <Select value={editMode} onValueChange={(v) => setEditMode(v as ExpiryMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">按天数</SelectItem>
                  <SelectItem value="date">按到期日期</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editMode === "days" ? (
              <div className="space-y-1.5">
                <Label>授权天数（从当前时间起算）</Label>
                <Input type="number" min={1} value={editDays} onChange={(e) => setEditDays(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>到期日期</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPerm(null)}>取消</Button>
            <Button disabled={updatePerm.isPending} onClick={() => updatePerm.mutate()}>
              {updatePerm.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}