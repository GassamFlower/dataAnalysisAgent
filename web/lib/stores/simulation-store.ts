"use client";

import { create } from "zustand";

import type { HypothesisPath, SimulationConfig } from "@/types";

interface SimulationState {
  /** 用户一句话假设（A 体验输入） */
  hypothesisText: string;
  /** 解析后的主效应路径 */
  paths: HypothesisPath[];
  /** 份数 */
  sampleSize: number;
  /** 当前步骤：输入假设 → 确认矩阵 → 生成中 → 完成 */
  stage: "input" | "matrix" | "generating" | "done";

  setHypothesisText: (text: string) => void;
  setPaths: (paths: HypothesisPath[]) => void;
  setSampleSize: (n: number) => void;
  setStage: (stage: SimulationState["stage"]) => void;
  reset: () => void;

  /** 导出 SimulationConfig（C 底层传参） */
  toConfig: () => SimulationConfig;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  hypothesisText: "",
  paths: [],
  sampleSize: 200,
  stage: "input",

  setHypothesisText: (text) => set({ hypothesisText: text }),
  setPaths: (paths) => set({ paths }),
  setSampleSize: (n) => set({ sampleSize: n }),
  setStage: (stage) => set({ stage }),
  reset: () =>
    set({ hypothesisText: "", paths: [], sampleSize: 200, stage: "input" }),

  toConfig: () => ({
    sampleSize: get().sampleSize,
    hypothesisText: get().hypothesisText,
    paths: get().paths,
  }),
}));
