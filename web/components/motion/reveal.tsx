"use client";

import type { ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  type Variants,
  type Variant,
  type Target,
  type Transition,
} from "framer-motion";

/**
 * M1 全局动效底座 —— "呼吸感"基础设施。
 *
 * 铁律：视觉值自 design tokens 取（styles/tokens.css）；动效参数统一对齐
 * tokens 的 --duration-* 与 --ease-out，保证全站节奏一致。
 *
 * 兼容性：
 * - 尊重 prefers-reduced-motion：开启时退化为无动画（无障碍硬承诺）。
 * - 元素均由 opacity 0→1 / 轻微位移入场，不长时间不可见。
 */

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const DURATION = 0.5;

/** 构造 hidden 目标（含方向位移） */
function buildHidden(
  direction: "up" | "left" | "opacity",
  distance: number
): Target {
  if (direction === "up") return { opacity: 0, y: distance };
  if (direction === "left") return { opacity: 0, x: -distance };
  return { opacity: 0 };
}

export interface RevealProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "left" | "opacity";
  delay?: number;
  duration?: number;
  distance?: number;
  onView?: boolean;
  amount?: number;
}

/**
 * 单元素滚动入场。
 * <Reveal onView><Card/></Reveal>
 */
export function Reveal({
  children,
  className,
  direction = "up",
  delay = 0,
  duration = DURATION,
  distance = 24,
  onView = true,
  amount = 0.15,
}: RevealProps) {
  const reduced = useReducedMotion();
  const hidden: Target = reduced
    ? { opacity: 0 }
    : buildHidden(direction, distance);
  const visible: Variant = {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { duration, delay, ease: EASE_OUT },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView={onView ? "visible" : undefined}
      animate={onView ? undefined : "visible"}
      viewport={{ once: true, amount }}
      variants={{ hidden, visible }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ================= Stagger（父条目序列扩散） ================= */

export function Stagger({
  children,
  className,
  step = 0.08,
  delay = 0,
  onView = true,
  amount = 0.1,
}: {
  children: ReactNode;
  className?: string;
  step?: number;
  delay?: number;
  onView?: boolean;
  amount?: number;
}) {
  const reduced = useReducedMotion();
  const transition: Transition = reduced
    ? { delayChildren: delay }
    : { staggerChildren: step, delayChildren: delay };

  const container: Variants = { hidden: {}, visible: { transition } };

  return (
    <motion.div
      initial="hidden"
      whileInView={onView ? "visible" : undefined}
      animate={onView ? undefined : "visible"}
      viewport={{ once: true, amount }}
      variants={container}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  direction = "up",
  distance = 20,
}: {
  children: ReactNode;
  className?: string;
  direction?: "up" | "left" | "opacity";
  distance?: number;
}) {
  const reduced = useReducedMotion();
  const itemVariants: Variants = reduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.01 } },
      }
    : {
        hidden: buildHidden(direction, distance),
        visible: {
          opacity: 1,
          y: 0,
          x: 0,
          transition: { duration: DURATION, ease: EASE_OUT },
        },
      };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

export default Reveal;