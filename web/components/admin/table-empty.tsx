import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

/**
 * 后台表格空状态：跨 colSpan 的一行友好提示。
 */
export function TableEmpty({
  colSpan,
  message = "暂无数据",
  hint,
}: {
  colSpan: number;
  message?: string;
  hint?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-center">
          <Inbox className="h-8 w-8 text-ink-300" />
          <div className="text-sm font-medium text-ink-500">{message}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </td>
    </tr>
  );
}
