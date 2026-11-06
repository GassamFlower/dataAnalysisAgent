import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// 自定义字号（text-caption 等）必须注册：否则 tailwind-merge 会把它们当成文字颜色，
// 覆盖同一元素上的 text-primary-foreground 等前景色。
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["caption", "small", "body", "body-lg", "h3", "h2", "h1", "display"],
        },
      ],
    },
  },
});

/**
 * 合并 Tailwind 类名，避免冲突。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
