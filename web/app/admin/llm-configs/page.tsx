"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { TableEmpty } from "@/components/admin/table-empty";
import { PageLoading } from "@/components/admin/loading";

interface LlmConfigItem {
  id: number;
  config_key: string;
  config_value: string;
  description: string;
  is_enabled: boolean;
  created_at: string | null;
}

const VALID_PROVIDERS = ["openai", "anthropic", "deepseek"];

export default function AdminLlmConfigsPage() {
  const qc = useQueryClient();
  // 新增表单
  const [showNew, setShowNew] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [desc, setDesc] = useState("");
  // 编辑态
  const [editing, setEditing] = useState<LlmConfigItem | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-llm-configs"],
    queryFn: () => apiClient.get<{ items: LlmConfigItem[] }>("/api/v1/llm-configs"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-llm-configs"] });

  const createConfig = useMutation({
    mutationFn: () =>
      apiClient.post<LlmConfigItem>("/api/v1/llm-configs", {
        config_key: key.trim(),
        config_value: value.trim(),
        description: desc.trim(),
        is_enabled: true,
      }),
    onSuccess: () => {
      invalidate();
      setShowNew(false);
      setKey("");
      setValue("");
      setDesc("");
    },
  });

  const updateConfig = useMutation({
    mutationFn: () =>
      apiClient.patch<LlmConfigItem>(`/api/v1/llm-configs/${editing!.id}`, {
        config_value: editValue.trim(),
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: (item: LlmConfigItem) =>
      apiClient.patch<LlmConfigItem>(`/api/v1/llm-configs/${item.id}`, {
        config_value: item.config_value,
        is_enabled: !item.is_enabled,
      }),
    onSuccess: () => invalidate(),
  });

  const deleteConfig = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/v1/llm-configs/${id}`),
    onSuccess: () => invalidate(),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="LLM 配置"
        description={
          <>
            关联供应商、密钥与模型偏好（仅管理员；含{" "}
            <code className="rounded bg-muted px-1">llm.preferred_provider</code> 白名单校验）
          </>
        }
        actions={
          <Button size="sm" onClick={() => setShowNew((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" /> 新增配置
          </Button>
        }
      />

      {showNew && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">新增配置项</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>配置键 config_key</Label>
              <Input placeholder="如 llm.preferred_provider" value={key} onChange={(e) => setKey(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>配置值 config_value</Label>
              <Input placeholder="如 deepseek / sk-..." value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>描述</Label>
            <Textarea placeholder="说明用途（可选）" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          {key.trim() === "llm.preferred_provider" && (
            <p className="text-xs text-muted-foreground">
              可用供应商：{VALID_PROVIDERS.join(" / ")}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={!key.trim() || createConfig.isPending} onClick={() => createConfig.mutate()}>
              {createConfig.isPending ? "保存中..." : "保存"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>
              取消
            </Button>
          </div>
        </div>
      )}

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
                <th className="px-3 py-2">配置键</th>
                <th className="px-3 py-2">值</th>
                <th className="px-3 py-2">描述</th>
                <th className="px-3 py-2">启用</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <TableEmpty colSpan={5} message="暂无 LLM 配置项" hint="点击右上角「新增配置」创建" />
              )}
              {data.items.map((c) => (
                <tr key={c.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.config_key}</code>
                  </td>
                  <td className="px-3 py-2">
                    {editing?.id === c.id ? (
                      <div className="flex items-center gap-1">
                        <Input className="h-7 min-w-[220px] text-xs" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                        <Button size="sm" variant="outline" onClick={() => updateConfig.mutate()} disabled={updateConfig.isPending}>
                          保存
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-ink-700" title={c.config_value}>
                        {c.config_key.includes("key") || c.config_key.includes("secret")
                          ? "••••••••"
                          : c.config_value.slice(0, 40)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.description || "-"}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleEnabled.mutate(c)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.is_enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}
                    >
                      {c.is_enabled ? "启用" : "停用"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(c);
                          setEditValue(c.config_value);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm(`删除配置 ${c.config_key} ？`)) deleteConfig.mutate(c.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}