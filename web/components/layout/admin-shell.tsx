"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Loader2,
  ShieldCheck,
  Users,
  Receipt,
  SlidersHorizontal,
  BarChart3,
  ScrollText,
  Cpu,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";

const adminNavItems = [
  { href: "/admin/metrics", label: "运营概览", icon: BarChart3, exact: true },
  { href: "/admin/users", label: "用户与项目", icon: Users },
  { href: "/admin/orders", label: "订单与支付", icon: Receipt },
  { href: "/admin/configs", label: "配置与配额", icon: SlidersHorizontal },
  { href: "/admin/llm-configs", label: "LLM 配置", icon: Cpu },
  { href: "/admin/tutorials", label: "内容管理", icon: ScrollText },
  { href: "/admin/audit-logs", label: "审计日志", icon: ShieldCheck },
];

/**
 * 管理后台 Shell：桌面端左侧栏 + 移动端顶部栏。
 * 守卫：未登录 → /login；已登录但非管理员 → 403。
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);

  // 守卫：未登录跳登录；已登录但非管理员提示无权限
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm space-y-3 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-ink-300" />
          <h2 className="font-display text-lg font-bold text-ink-900">
            需要管理员权限
          </h2>
          <p className="text-sm text-muted-foreground">
            当前账号不是管理员，无法访问管理后台。
          </p>
          <Link
            href="/projects"
            className="mt-2 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            返回我的项目
          </Link>
        </div>
      </div>
    );
  }

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-ink-700 hover:bg-accent hover:text-accent-foreground"
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold text-ink-900">
            管理后台
          </h1>
        </div>
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-ink-900">
          返回端应用 ↗
        </Link>
      </div>
      <nav className="flex flex-wrap items-center gap-1.5 pb-2">
        {adminNavItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href + "/") || pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClass(active)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}