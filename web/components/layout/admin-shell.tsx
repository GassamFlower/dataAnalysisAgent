"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Loader2,
  ShieldCheck,
  UserCog,
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
  ChevronRight,
  ChevronDown,
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
import { ThemeToggle } from "@/components/theme-toggle";

type AdminNavItem = { href: string; label: string; icon: typeof BarChart3 };

/** 日常操作：首屏只保留概览、用户、订单 */
const adminPrimaryGroups: { label: string; items: AdminNavItem[] }[] = [
  {
    label: "概览",
    items: [{ href: "/admin/metrics", label: "运营概览", icon: BarChart3 }],
  },
  {
    label: "运营",
    items: [
      { href: "/admin/users", label: "用户与项目", icon: Users },
      { href: "/admin/orders", label: "订单与支付", icon: Receipt },
    ],
  },
];

/** 低频配置：折叠在“高级”分组下 */
const adminAdvancedItems: AdminNavItem[] = [
  { href: "/admin/messages", label: "留言管理", icon: MessageSquare },
  { href: "/admin/tutorials", label: "教程管理", icon: ScrollText },
  { href: "/admin/configs", label: "配置与配额", icon: SlidersHorizontal },
  { href: "/admin/llm-configs", label: "LLM 配置", icon: Cpu },
  { href: "/admin/audit-logs", label: "审计日志", icon: ShieldCheck },
];

/** 当前路径对应的后台栏目名称 */
function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/admin/permissions")) return "管理员授权";
  const allItems = [...adminPrimaryGroups.flatMap((group) => group.items), ...adminAdvancedItems];
  const hit = allItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  return hit?.label ?? "运营概览";
}

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
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin ?? false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // 等待客户端 mount 后再判定登录态，避免持久化 token 尚未 rehydrate 时误跳登录
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 守卫：未登录跳登录；已登录但非管理员提示无权限
  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [mounted, isAuthenticated, pathname, router]);

  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm space-y-3 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-ink-400" />
          <h2 className="text-h3 font-semibold text-ink-900">需要管理员权限</h2>
          <p className="text-body text-ink-500">
            当前账号不是管理员，无法访问管理后台。
          </p>
          <Button asChild className="mt-2">
            <Link href="/projects">返回我的项目</Link>
          </Button>
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
      "touch-target flex h-9 items-center gap-2.5 rounded-md px-3 text-small transition-colors duration-fast ease-out",
      active
        ? "bg-[var(--brand-soft)] font-medium text-primary"
        : "text-ink-700 hover:bg-card hover:text-ink-900"
    );

  const isAdvancedActive = adminAdvancedItems.some((item) => isActive(item.href));
  const showAdvanced = advancedOpen || isAdvancedActive || isActive("/admin/permissions");

  const renderNavItem = (item: AdminNavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={navLinkClass(active)}
        aria-current={active ? "page" : undefined}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  const navBody = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {adminPrimaryGroups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
            {group.label}
          </div>
          <div className="space-y-0.5">{group.items.map(renderNavItem)}</div>
        </div>
      ))}

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="touch-target flex h-9 w-full items-center justify-between px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400 transition-colors hover:text-ink-700"
          aria-expanded={showAdvanced}
        >
          高级
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-fast",
              showAdvanced && "rotate-180"
            )}
          />
        </button>
        {showAdvanced ? (
          <div className="space-y-0.5">
            {adminAdvancedItems.map(renderNavItem)}
            {isSuperAdmin ? (
              <Link
                href="/admin/permissions"
                onClick={() => setMobileOpen(false)}
                className={navLinkClass(isActive("/admin/permissions"))}
                aria-current={isActive("/admin/permissions") ? "page" : undefined}
              >
                <UserCog className="h-4 w-4 shrink-0" />
                管理员授权
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );

  /** 底部身份区：头像首字 + 昵称/管理员 + 退出 */
  const identityBlock = (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-small font-medium text-ink-700">
          {(user?.nickname || "管").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-small font-medium text-ink-900">
            {user?.nickname || "管理员"}
          </div>
          <div className="text-[11px] text-ink-500">
            {isSuperAdmin ? "超级管理员" : "后台管理员"}
          </div>
        </div>
      </div>
      <div className="mt-1 flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-start"
          onClick={() => {
            logout();
            router.push("/");
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          退出
        </Button>
        <Link
          href="/projects"
          className="inline-flex flex-1 items-center justify-start gap-1.5 rounded-md px-2.5 py-1.5 text-caption text-ink-700 transition-colors hover:bg-secondary hover:text-ink-900"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          端应用
        </Link>
      </div>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900 text-background">
        <ShieldCheck className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-body font-semibold leading-tight text-ink-900">
          管理后台
        </span>
        <span className="block text-[11px] leading-tight text-ink-500">
          运营与系统配置
        </span>
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 桌面端左侧固定边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border bg-cream-surface md:flex">
        <div className="flex h-16 items-center border-b border-border px-4">
          {brand}
        </div>
        {navBody}
        {identityBlock}
      </aside>

      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-[var(--glass-bg)] px-4 backdrop-blur md:hidden">
        {brand}
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="打开后台菜单">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[280px] flex-col bg-cream-surface p-0"
            >
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle className="sr-only">后台菜单</SheetTitle>
                {brand}
              </SheetHeader>
              <div className="flex flex-1 flex-col overflow-hidden">
                {navBody}
                {identityBlock}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* 桌面端顶栏：位置 + 主题 */}
      <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border bg-[var(--glass-bg)] px-8 backdrop-blur md:flex md:pl-[280px]">
        <div className="flex items-center gap-1.5 text-small text-ink-500">
          <span>管理后台</span>
          <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
          <span className="font-medium text-ink-900">
            {sectionLabel(pathname)}
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* 主内容区：更宽的工作台内容 */}
      <main className="md:pl-[248px]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
