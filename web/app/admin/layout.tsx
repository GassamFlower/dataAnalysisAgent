import { AdminShell } from "@/components/layout/admin-shell";

/**
 * 管理后台布局（F-ADM）。顶层 /admin 独立路由组（已脱离 (app) AppShell 双层导航）。
 * AdminShell 负责：admin 守卫（登录 + is_admin）+ 左侧边栏分组导航 + 身份区/退出。
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}