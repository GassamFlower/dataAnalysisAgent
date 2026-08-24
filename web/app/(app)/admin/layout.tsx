import { AdminShell } from "@/components/layout/admin-shell";

/**
 * 管理后台布局（F-ADM）。嵌套于 (app) AppShell 内。
 * AdminShell 负责 admin 守卫（登录 + is_admin）+ 模块导航。
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}