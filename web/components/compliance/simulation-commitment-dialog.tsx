"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface SimulationCommitmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 模拟数据承诺框组件。
 * 
 * 在生成模拟数据前弹出，要求用户确认数据用途并承诺不用于正式论文。
 */
export function SimulationCommitmentDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: SimulationCommitmentDialogProps) {
  const [agreed, setAgreed] = useState(false);

  const handleConfirm = () => {
    if (agreed) {
      onConfirm();
      setAgreed(false);
    }
  };

  const handleCancel = () => {
    setAgreed(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-warning" />
            模拟数据生成确认
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-ink-700">
                您即将生成<span className="font-semibold text-ink-900">模拟数据</span>，请确认以下事项：
              </p>
              <ul className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-ink-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-warning">•</span>
                  <span>此数据仅用于学习和研究目的，<strong>不得用于正式学术论文</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-warning">•</span>
                  <span>不得将模拟数据作为真实调研数据提交</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-warning">•</span>
                  <span>所有分析结果仅供参考，最终学术成果需基于真实数据</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-warning">•</span>
                  <span>遵守学术道德规范，不抄袭、不造假</span>
                </li>
              </ul>
              <div className="flex items-start space-x-2 pt-2">
                <Checkbox
                  id="commitment"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                />
                <Label
                  htmlFor="commitment"
                  className="text-sm font-normal leading-relaxed text-ink-700"
                >
                  我已阅读并理解上述承诺，确认生成模拟数据仅用于学习研究
                </Label>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!agreed}
          >
            确认生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
