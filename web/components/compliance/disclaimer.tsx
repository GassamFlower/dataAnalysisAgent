"use client";

/**
 * 免责声明组件。
 * 
 * 用于报告页底部和网站页脚，声明工具用途和责任限制。
 */
export function Disclaimer({ variant = "full" }: { variant?: "full" | "short" }) {
  if (variant === "short") {
    return (
      <p className="text-xs text-ink-500">
        本工具仅供学习研究，生成内容不得用于正式学术论文。
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-cream-surface p-4 text-xs text-ink-600">
      <h4 className="font-semibold text-ink-900">免责声明</h4>
      <ul className="space-y-1 leading-relaxed">
        <li>• 本工具生成的模拟数据仅供学习和研究目的，不得用于正式学术论文或商业用途。</li>
        <li>• 所有分析结果仅供参考，用户应对使用本工具产生的内容负责。</li>
        <li>• 我们不对因使用本服务而产生的任何直接或间接损失承担责任。</li>
        <li>• 用户应遵守学术道德规范，不得将模拟数据作为真实数据提交。</li>
        <li>• 我们保留随时修改、中断或终止服务的权利，无需事先通知。</li>
      </ul>
      <p className="pt-2 text-ink-500">
        使用本服务即表示您同意上述条款。如有疑问，请联系客服或查阅帮助中心。
      </p>
    </div>
  );
}
