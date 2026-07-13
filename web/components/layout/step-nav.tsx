import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { PROJECT_STEPS, type ProjectStepKey } from "@/lib/constants";

/**
 * 步骤导航。对应宪法流程：体检 → 生成 → 报告。
 * 用于项目工作台 / 数据生成 / 报告页顶部。
 */
export function StepNav({
  projectId,
  current,
}: {
  projectId: string;
  current: ProjectStepKey;
}) {
  const currentIndex = PROJECT_STEPS.findIndex((s) => s.key === current);

  const hrefFor = (key: ProjectStepKey) => {
    if (key === "inspect") return `/projects/${projectId}`;
    if (key === "simulate") return `/projects/${projectId}/simulate`;
    if (key === "report") return `/projects/${projectId}/report`;
    if (key === "export") return `/projects/${projectId}/export`;
    return `/projects/${projectId}`;
  };

  return (
    <nav aria-label="项目流程" className="mb-8">
      <ol className="flex items-center">
        {PROJECT_STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const href = hrefFor(step.key);

          return (
            <li key={step.key} className="flex flex-1 items-center last:flex-none">
              <Link
                href={href}
                className="group flex items-center gap-3"
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-base ease-out",
                    active && "border-primary bg-primary text-primary-foreground",
                    done && "border-success bg-success text-success-foreground",
                    !active && !done && "border-border bg-cream-surface text-ink-400"
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-small font-semibold">{i + 1}</span>
                  )}
                </span>
                <span className="hidden sm:block">
                  <span
                    className={cn(
                      "block text-body font-medium",
                      active ? "text-ink-900" : "text-ink-500"
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="block text-caption text-ink-400">
                    {step.description}
                  </span>
                </span>
              </Link>

              {i < PROJECT_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-4 h-px flex-1 transition-colors duration-base ease-out",
                    done ? "bg-success" : "bg-border"
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
