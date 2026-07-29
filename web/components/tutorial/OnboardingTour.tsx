"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useTutorialProgress,
  useUpdateTutorialProgress,
  useStartOnboarding,
  type OnboardingStep,
} from "@/lib/hooks/use-tutorial";
import { cn } from "@/lib/utils";

interface OnboardingTourProps {
  /** 当前项目 ID（用于启动引导） */
  projectId?: string;
  /** 是否强制显示（用于设置页的重新播放） */
  forceOpen?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 新手引导浮层组件。
 *
 * 在用户首次进入项目时显示分步骤引导气泡，
 * 引导用户完成题目体检 → 假设输入 → 数据预演 → 生成报告的主流程。
 */
export function OnboardingTour({
  projectId,
  forceOpen = false,
  onClose,
}: OnboardingTourProps) {
  const pathname = usePathname();
  const { data: progress, isLoading } = useTutorialProgress();
  const { mutate: updateProgress } = useUpdateTutorialProgress();
  const { mutate: startOnboarding } = useStartOnboarding();

  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // 是否应该在当前页面显示引导
  const shouldShowTour = useMemo(() => {
    if (forceOpen) return true;
    if (isLoading || !progress) return false;
    if (progress.completed) return false;

    // 在项目详情页及其子页面显示
    return pathname?.includes("/projects/");
  }, [forceOpen, isLoading, pathname, progress]);

  // 启动引导
  useEffect(() => {
    if (!shouldShowTour) return;

    // 强制显示或未完成时才启动
    if (forceOpen || (progress && !progress.completed)) {
      if (projectId) {
        startOnboarding(
          { project_id: projectId },
          {
            onSuccess: (data) => {
              setSteps(data.steps);
              setCurrentStep(progress?.current_step ?? 0);
              setIsOpen(true);
            },
          }
        );
      } else {
        // 无项目 ID 时使用默认步骤
        setSteps(DEFAULT_STEPS);
        setCurrentStep(progress?.current_step ?? 0);
        setIsOpen(true);
      }
    }
  }, [shouldShowTour, projectId, progress, forceOpen, startOnboarding]);

  const activeStep = steps[currentStep];

  // 更新进度
  const handleStepChange = (newStep: number) => {
    setCurrentStep(newStep);
    if (activeStep) {
      updateProgress({
        step: activeStep.step,
        completed: true,
      });
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      handleStepChange(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    if (activeStep) {
      updateProgress({ step: activeStep.step, completed: true });
    }
    setIsOpen(false);
    onClose?.();
  };

  const handleSkip = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (!isOpen || !activeStep) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={handleSkip}
          />

          {/* 引导卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed z-50 w-[360px] shadow-2xl",
              getStepPosition(activeStep.target)
            )}
          >
            <Card className="relative overflow-hidden border-2 border-primary/20 bg-white/95 p-0 backdrop-blur-md">
              {/* 顶部进度条 */}
              <div className="absolute left-0 top-0 h-1 bg-primary/10 w-full">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${((currentStep + 1) / steps.length) * 100}%`,
                  }}
                />
              </div>

              {/* 关闭按钮 */}
              <button
                onClick={handleSkip}
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="跳过引导"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="p-5 pt-6">
                {/* 步骤标题 */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {activeStep.step}
                  </span>
                  <h3 className="text-lg font-semibold">{activeStep.title}</h3>
                </div>

                {/* 步骤说明 */}
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  {activeStep.description}
                </p>

                {/* 底部操作区 */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {currentStep + 1} / {steps.length}
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStep > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrev}
                        className="h-8 px-2"
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        上一步
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={handleNext}
                      className="h-8"
                    >
                      {currentStep === steps.length - 1 ? (
                        <>
                          完成
                          <Check className="ml-1 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          下一步
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* 指向目标的小三角 */}
            <div
              className={cn(
                "absolute h-3 w-3 rotate-45 border-2 border-primary/20 bg-white/95",
                getArrowPosition(activeStep.target)
              )}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// 默认步骤（无项目 ID 时使用）
const DEFAULT_STEPS: OnboardingStep[] = [
  {
    step: 1,
    title: "欢迎使用渔宴数据分析",
    description:
      "这是一个帮助你完成毕业论文数据分析的工具。接下来我们会一步步引导你完成整个流程。",
    target: "sidebar-projects",
  },
  {
    step: 2,
    title: "第一步：题目体检",
    description: "上传你的问卷题目，AI 会自动识别题型、维度归属和反向题。",
    target: "step-inspect",
  },
  {
    step: 3,
    title: "第二步：假设输入",
    description: "用一句话描述你的研究假设，系统会自动解析为主效应路径。",
    target: "step-hypothesis",
  },
  {
    step: 4,
    title: "第三步：数据预演",
    description: "设置样本量和期望趋势，系统会生成模拟数据供你预演分析。",
    target: "step-simulate",
  },
  {
    step: 5,
    title: "第四步：生成报告",
    description: "系统会自动计算信效度、诊断问题，并生成完整的统计报告。",
    target: "step-report",
  },
];

// 根据目标元素决定引导卡片位置
function getStepPosition(target: string): string {
  switch (target) {
    case "sidebar-projects":
      return "left-4 top-20";
    case "step-inspect":
      return "left-1/2 top-1/4 -translate-x-1/2";
    case "step-hypothesis":
      return "left-1/2 top-1/3 -translate-x-1/2";
    case "step-simulate":
      return "right-8 top-1/3";
    case "step-report":
      return "right-8 bottom-1/4";
    default:
      return "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";
  }
}

// 根据目标元素决定箭头位置
function getArrowPosition(target: string): string {
  switch (target) {
    case "sidebar-projects":
      return "-left-1.5 top-8 border-r-0 border-t-0";
    case "step-inspect":
      return "left-1/2 -top-1.5 -translate-x-1/2 border-b-0 border-r-0";
    case "step-hypothesis":
      return "left-1/2 -top-1.5 -translate-x-1/2 border-b-0 border-r-0";
    case "step-simulate":
      return "-right-1.5 top-8 border-l-0 border-b-0";
    case "step-report":
      return "-right-1.5 bottom-8 border-l-0 border-t-0";
    default:
      return "left-1/2 -top-1.5 -translate-x-1/2 border-b-0 border-r-0";
  }
}
