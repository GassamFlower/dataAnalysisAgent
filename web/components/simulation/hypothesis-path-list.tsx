"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { nextStrength, STRENGTH_OPTIONS, type Strength } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { HypothesisPath } from "@/types";

const STRENGTH_BADGE: Record<
  Strength,
  { label: string; variant: "secondary" | "warning" | "success" }
> = {
  weak: { label: "弱相关", variant: "secondary" },
  medium: { label: "中等相关", variant: "warning" },
  strong: { label: "强相关", variant: "success" },
};

interface HypothesisPathListProps {
  paths: HypothesisPath[];
  onStrengthChange?: (index: number, strength: Strength) => void;
  onDirectionChange?: (index: number, direction: "positive" | "negative") => void;
  onDelete?: (index: number) => void;
  onAdd?: (path: HypothesisPath) => void;
  /** 可选：用于添加路径时自动补全 */
  dimensions?: string[];
}

/**
 * 假设路径可视化列表（宪法第 12 条：透明可编辑）。
 * 每条路径以卡片形式展示：自变量 →（方向）→ 因变量 + 强度 Badge。
 * 支持强度循环切换、方向切换、删除、手动添加路径。
 */
export function HypothesisPathList({
  paths,
  onStrengthChange,
  onDirectionChange,
  onDelete,
  onAdd,
  dimensions,
}: HypothesisPathListProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<HypothesisPath>({
    predictor: "",
    outcome: "",
    direction: "positive",
    strength: "medium",
  });

  // 空列表且不支持添加：不渲染
  if (paths.length === 0 && !onAdd) return null;

  const submitAdd = () => {
    if (!draft.predictor.trim() || !draft.outcome.trim()) return;
    onAdd?.({
      predictor: draft.predictor.trim(),
      outcome: draft.outcome.trim(),
      direction: draft.direction,
      strength: draft.strength,
    });
    setDraft({ predictor: "", outcome: "", direction: "positive", strength: "medium" });
    setAddOpen(false);
  };

  return (
    <div className="mt-3 space-y-2">
      {paths.length > 0 && (
        <>
          <p className="text-caption font-medium text-ink-700">
            解析出 {paths.length} 条假设路径：
          </p>
          <ul className="space-y-2">
            {paths.map((path, idx) => {
              const isPositive = path.direction === "positive";
              const badge = STRENGTH_BADGE[path.strength];
              const directionClass = isPositive
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive";
              const directionEditable = !!onDirectionChange;
              const strengthEditable = !!onStrengthChange;
              return (
                <li
                  key={`${path.predictor}-${path.outcome}-${idx}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-cream-surface/60 px-3 py-2"
                >
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] leading-none text-ink-400">自变量</span>
                      <span className="text-body font-medium text-ink-900">{path.predictor}</span>
                    </div>

                    {directionEditable ? (
                      <button
                        type="button"
                        onClick={() =>
                          onDirectionChange!(idx, isPositive ? "negative" : "positive")
                        }
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          directionClass
                        )}
                        title="点击切换方向"
                      >
                        {isPositive ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                        {isPositive ? "正向" : "负向"}
                      </button>
                    ) : (
                      <div
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium",
                          directionClass
                        )}
                      >
                        {isPositive ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                        {isPositive ? "正向" : "负向"}
                      </div>
                    )}

                    <div className="flex flex-col">
                      <span className="text-[10px] leading-none text-ink-400">因变量</span>
                      <span className="text-body font-medium text-ink-900">{path.outcome}</span>
                    </div>
                  </div>

                  {strengthEditable ? (
                    <button
                      type="button"
                      onClick={() => onStrengthChange!(idx, nextStrength(path.strength))}
                      className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="点击切换强度档位"
                    >
                      <Badge variant={badge.variant} className="cursor-pointer">
                        {badge.label}
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  )}

                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-ink-400 hover:text-destructive"
                      onClick={() => onDelete(idx)}
                      title="删除该路径"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {onAdd && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full border-dashed">
              <Plus className="mr-1.5 h-4 w-4" />
              添加路径
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>添加假设路径</DialogTitle>
              <DialogDescription>
                手动添加一条假设路径，将自动同步到相关矩阵。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="predictor">自变量维度</Label>
                <Input
                  id="predictor"
                  value={draft.predictor}
                  onChange={(e) => setDraft({ ...draft, predictor: e.target.value })}
                  placeholder="如：工作满意度"
                  list="dimension-options"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="outcome">因变量维度</Label>
                <Input
                  id="outcome"
                  value={draft.outcome}
                  onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}
                  placeholder="如：离职意向"
                  list="dimension-options"
                />
              </div>
              {dimensions && dimensions.length > 0 && (
                <datalist id="dimension-options">
                  {dimensions.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>方向</Label>
                  <div className="flex gap-2">
                    <Badge
                      variant={draft.direction === "positive" ? "success" : "outline"}
                      className="cursor-pointer font-normal"
                      role="button"
                      aria-pressed={draft.direction === "positive"}
                      onClick={() => setDraft({ ...draft, direction: "positive" })}
                    >
                      <ArrowUp className="mr-1 h-3 w-3" /> 正向
                    </Badge>
                    <Badge
                      variant={draft.direction === "negative" ? "destructive" : "outline"}
                      className="cursor-pointer font-normal"
                      role="button"
                      aria-pressed={draft.direction === "negative"}
                      onClick={() => setDraft({ ...draft, direction: "negative" })}
                    >
                      <ArrowDown className="mr-1 h-3 w-3" /> 负向
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>强度</Label>
                  <Select
                    value={draft.strength}
                    onValueChange={(v) => setDraft({ ...draft, strength: v as Strength })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRENGTH_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                取消
              </Button>
              <Button
                onClick={submitAdd}
                disabled={!draft.predictor.trim() || !draft.outcome.trim()}
              >
                添加
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
