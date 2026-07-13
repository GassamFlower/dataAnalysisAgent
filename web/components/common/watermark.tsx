import { SIMULATED_WATERMARK, DISCLAIMER } from "@/lib/constants";

/**
 * 水印组件（宪法第 7 条：水印铁律）。
 * 两种用法：
 * 1. inline（默认）：低调的行内提示条，标注 SIMULATED + 免责声明，不遮挡视线。
 * 2. overlay：固定浮层，重复斜向水印，pointer-events-none，不可去除（仅在导出预览等场景使用）。
 */
export function Watermark({
  variant = "inline",
  className,
}: {
  variant?: "overlay" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <div
        className={
          "flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-cream-muted/50 px-3 py-1.5 text-caption " +
          (className ?? "")
        }
        role="note"
      >
        <span className="font-mono font-medium tracking-wider text-ink-500">
          {SIMULATED_WATERMARK}
        </span>
        <span className="text-ink-300">·</span>
        <span className="text-ink-400">{DISCLAIMER}</span>
      </div>
    );
  }

  // overlay：固定全屏，斜向重复水印，不可交互、不可去除
  return (
    <div
      aria-hidden
      className={
        "pointer-events-none fixed inset-0 z-[60] overflow-hidden " +
        (className ?? "")
      }
    >
      <div
        className="absolute -inset-1/2 rotate-[-24deg] select-none text-caption tracking-[0.3em] text-ink-400/[0.08]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 120px,
            currentColor 120px,
            currentColor 132px
          )`,
        }}
      >
        <div className="whitespace-nowrap p-8 font-mono">
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} className="mr-12">
              {SIMULATED_WATERMARK}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
