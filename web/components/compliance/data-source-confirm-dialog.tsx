"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

type DataSourceType = "real" | "simulated";

interface DataSourceConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dataSource: DataSourceType) => void;
  onCancel: () => void;
  /** 项目模式：simulation 模式下导出将强制标记为 simulated */
  projectMode?: "real" | "simulation";
}

/**
 * 数据来源确认弹窗。
 *
 * 在导出报告/数据前弹出，要求用户确认数据来源类型。
 */
export function DataSourceConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  projectMode = "real",
}: DataSourceConfirmDialogProps) {
  const [dataSource, setDataSource] = useState<DataSourceType>(
    projectMode === "simulation" ? "simulated" : "real"
  );

  useEffect(() => {
    if (open) {
      setDataSource(projectMode === "simulation" ? "simulated" : "real");
    }
  }, [open, projectMode]);

  const handleConfirm = () => {
    onConfirm(dataSource);
  };

  const handleCancel = () => {
    setDataSource(projectMode === "simulation" ? "simulated" : "real");
    onCancel();
  };

  const isModeMismatch = projectMode === "simulation" && dataSource === "real";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-brand-indigo" />
            数据来源确认
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-ink-700">
                请确认您即将导出的数据来源类型，以便我们在导出文件中添加正确的标识：
              </p>
              <RadioGroup
                value={dataSource}
                onValueChange={(value: string) =>
                  setDataSource(value as DataSourceType)
                }
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-cream-surface">
                  <RadioGroupItem value="real" id="real" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="real" className="font-semibold text-ink-900">
                      真实调研数据
                    </Label>
                    <p className="text-xs text-ink-600">
                      通过问卷调研、实验等方式收集的真实数据
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-cream-surface">
                  <RadioGroupItem
                    value="simulated"
                    id="simulated"
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor="simulated"
                      className="font-semibold text-ink-900"
                    >
                      模拟数据
                    </Label>
                    <p className="text-xs text-ink-600">
                      使用本工具生成的模拟数据，仅用于学习研究
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {projectMode === "simulation" && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-ink-700">
                  <strong>提示：</strong>当前项目为模拟预演模式，导出文件将强制包含
                  simulated 标识。
                </div>
              )}

              {isModeMismatch && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <strong>注意：</strong>当前项目基于模拟数据生成，选择「真实数据」与项目类型不一致，导出文件仍会标记为模拟数据。
                </div>
              )}

              {dataSource === "simulated" && !isModeMismatch && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-ink-700">
                  <strong>提醒：</strong>模拟数据不得用于正式学术论文，仅用于学习和研究目的。
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button onClick={handleConfirm}>确认并继续</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
