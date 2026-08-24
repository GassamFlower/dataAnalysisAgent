import { redirect } from "next/navigation";

/**
 * 管理后台入口：重定向到运营概览（指标看板）。
 */
export default function AdminIndexPage() {
  redirect("/admin/metrics");
}