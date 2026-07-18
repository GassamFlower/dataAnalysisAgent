"use client";

import { useState } from "react";
import { Plus, Pencil, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useUpdateDimensions } from "@/lib/hooks/use-questionnaire";

interface DimensionEditorProps {
  projectId: string;
  dimensions: string[];
}

export function DimensionEditor({ projectId, dimensions }: DimensionEditorProps) {
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const updateMutation = useUpdateDimensions();

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) {
      toast.error("请输入维度名称");
      return;
    }
    if (dimensions.includes(name)) {
      toast.error("维度已存在");
      return;
    }
    updateMutation.mutate(
      { projectId, action: "add", name },
      {
        onSuccess: () => setNewName(""),
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "新增维度失败");
        },
      }
    );
  };

  const startRename = (dim: string) => {
    setEditingName(dim);
    setRenameValue(dim);
  };

  const cancelRename = () => {
    setEditingName(null);
    setRenameValue("");
  };

  const handleRename = () => {
    if (!editingName) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("请输入维度名称");
      return;
    }
    if (name === editingName) {
      cancelRename();
      return;
    }
    if (dimensions.includes(name)) {
      toast.error("维度名称已存在");
      return;
    }
    updateMutation.mutate(
      { projectId, action: "rename", name, oldName: editingName },
      {
        onSuccess: () => cancelRename(),
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "重命名维度失败");
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {dimensions.map((dim) =>
          editingName === dim ? (
            <div key={dim} className="flex items-center gap-1">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-8 w-32"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") cancelRename();
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRename}
                disabled={updateMutation.isPending}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={cancelRename}
                disabled={updateMutation.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Badge
              key={dim}
              variant="secondary"
              className="gap-1 pr-1 font-normal"
            >
              {dim}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => startRename(dim)}
                disabled={updateMutation.isPending}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </Badge>
          )
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="新增维度名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-9 max-w-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={updateMutation.isPending || !newName.trim()}
        >
          <Plus className="mr-1 h-4 w-4" />
          新增维度
        </Button>
      </div>
    </div>
  );
}
