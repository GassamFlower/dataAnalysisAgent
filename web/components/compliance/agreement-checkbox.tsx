"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface AgreementCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * 注册页面协议勾选组件。
 * 
 * 包含服务条款和学术诚信承诺的勾选框。
 */
export function AgreementCheckbox({
  checked,
  onCheckedChange,
  disabled = false,
}: AgreementCheckboxProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-start space-x-2">
        <Checkbox
          id="agreement"
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
        <Label
          htmlFor="agreement"
          className="text-sm font-normal leading-relaxed text-ink-700"
        >
          我已阅读并同意{" "}
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="text-primary hover:underline"
          >
            《服务条款》和《学术诚信承诺》
          </button>
        </Label>
      </div>

      {showDetail && (
        <div className="ml-6 rounded-lg border border-border bg-cream-surface p-4 text-sm text-ink-700">
          <h4 className="mb-2 font-semibold text-ink-900">学术诚信承诺</h4>
          <ul className="space-y-1 text-xs leading-relaxed">
            <li>• 本工具仅用于学习和研究目的，生成的模拟数据不得用于正式学术论文</li>
            <li>• 不得将模拟数据作为真实调研数据提交</li>
            <li>• 所有分析结果仅供参考，最终学术成果需基于真实数据</li>
            <li>• 遵守学术道德规范，不抄袭、不造假</li>
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            <h4 className="mb-2 font-semibold text-ink-900">服务条款</h4>
            <p className="text-xs leading-relaxed">
              使用本服务即表示您同意我们的服务条款。我们保留随时修改或中断服务的权利。
              您应对使用本服务产生的内容负责，我们不对因使用本服务而产生的任何损失承担责任。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
