"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STRENGTH_OPTIONS, type Strength } from "@/lib/constants";

/**
 * 强度档位选择（宪法第 15 条：简化原则，不暴露 r 值）。
 * 仅弱 / 中 / 强三档，r 值映射在后端完成。
 */
export function StrengthSelector({
  value,
  onChange,
  disabled,
}: {
  value: Strength;
  onChange: (v: Strength) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as Strength)}
      disabled={disabled}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STRENGTH_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
