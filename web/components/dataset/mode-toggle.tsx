"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ModeToggleProps {
  mode: "real" | "simulation";
  onModeChange: (mode: "real" | "simulation") => void;
}

/**
 * 数据准备页模式切换器：真实数据导入 vs 模拟数据预演。
 */
export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <Tabs
      value={mode}
      onValueChange={(value) => onModeChange(value as "real" | "simulation")}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2 sm:w-auto">
        <TabsTrigger value="real">真实数据导入</TabsTrigger>
        <TabsTrigger value="simulation">模拟数据预演</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
