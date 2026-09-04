"use client";

import { useEffect, useState } from "react";
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
  MessageSquare,
  LogOut,
  ArrowUpRight,
  Menu,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** 导航分组：按后台工作台信息架构重新组织 */
const adminNavGroups: {
  label: string;
  items: { href: string; label: string; icon: typeof BarChart3 }[];
}[] = [
  {
    label: "概览",
    items: [{ href: "/admin/metrics", label: "运营概览", icon: BarChart3 }],
  },
  {
    label: "运营",
    items: [
      { href: "/admin/users", label: "用户与项目", icon: Users },
      { href: "/admin/orders", label: "订单与支付", icon: Receipt },
      { href: "/admin/messages", label: "留言管理", icon: MessageSquare },
    ],
  },
  {
    label: "内容",
    items: [{ href: "/admin/tutorials", label: "教程管理", icon: ScrollText }],
  },
  {
    label: "系统",
    items: [
      { href: "/admin/configs", label: "配置与配额", icon: SlidersHorizontal },
      { href: "/admin/llm-configs", label: "LLM 配置", icon: Cpu },
      { href: "/admin/audit-logs", label: "审计日志", icon: ShieldCheck },
    ],
  },
];

/**
 * 管理后台 Shell（F-ADM）：桌面端固定左侧边栏 + 移动端抽屉，独立于端应用 AppShell。
 * - 顶层 /admin 路由组使用（已脱离 (app) 双层导航，内容区更宽）。
 * - 守卫：未登录 → /login；已登录但非管理员 → 403。
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const isActive = (href: string) =>
    href === "/admin/metrics"
      ? pathname === href
      : pathname.startsWith(href + "/") || pathname === href;

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast ease-out",
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-ink-700 hover:bg-accent hover:text-accent-foreground"
    );

  const navBody = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {adminNavGroups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-ink-400">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass(active)}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  /** 底部身份区：头像首字 + 昵称/管理员 + 退出 */
  const identityBlock = (
    <div className="border-t border-border p-3">
      <div className="mb-2 flex items-center gap-2.5 rounded-md px-2 py-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {(user?.nickname || "管").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink-900">
            {user?.nickname || "管理员"}
          </div>
          <div className="text-xs text-ink-400">后台管理员</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-start text-ink-600"
          onClick={() => {
            logout();
            router.push("/");
          }}
        >
          <LogOut className="h-3.5 w-3.5" />退出
        </Button>
        <Link
          href="/projects"
          className="inline-flex flex-1 items-center justify-start gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink-600 hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />端应用
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 桌面端左侧固定边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-cream-surface md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-bold text-ink-900">
            管理后台
          </span>
        </div>
        {navBody}
        {identityBlock}
      </aside>

      {/* 移动端顶栏 */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-cream-surface px-4 md:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-bold text-ink-900">
            管理后台
          </span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="打开后台菜单">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col bg-cream-surface p-0">
            <SheetHeader className="border-b border-border p-5 text-left">
              <SheetTitle className="font-display text-lg text-ink-900">
                管理后台
              </SheetTitle>
            </SheetHeader>
            {navBody}
            {identityBlock}
          </SheetContent>
        </Sheet>
      </header>

      {/* 主内容区：更宽的工作台内容 */}
      <main className="pt-16 md:pl-64 md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
