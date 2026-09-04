import { Button } from "@/components/ui/button";

/**
 * 后台表格统一分页：共 N 条 + 上/下一页。
 * 页面数据超过一页时渲染。
 */
export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  unit = "条",
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  unit?: string;
}) {
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        共 {total} {unit}，第 {page} 页
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page * pageSize >= total}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
