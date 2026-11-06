"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  Settings,
  FileText,
  Loader2,
  Menu,
  GraduationCap,
  ShieldCheck,
  ChevronRight,
  LogOut,
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
import { Disclaimer } from "@/components/compliance/disclaimer";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/projects", label: "我的项目", icon: LayoutDashboard },
  { href: "/learn", label: "统计小课堂", icon: GraduationCap },
  { href: "/settings", label: "设置", icon: Settings },
];

const adminNavItem = { href: "/admin/metrics", label: "管理后台", icon: ShieldCheck };

const PLAN_LABELS: Record<string, string> = {
  free: "免费版",
  single: "单次套餐",
  report: "报告套餐",
  subscription: "订阅版",
};

/** 路径 → 顶栏位置名称 */
function sectionLabel(pathname: string): string {
  if (pathname === "/projects") return "我的项目";
  if (pathname === "/projects/new") return "新建项目";
  if (pathname.startsWith("/projects/")) return "项目工作台";
  if (pathname.startsWith("/learn")) return "统计小课堂";
  if (pathname.startsWith("/settings")) return "设置";
  if (pathname.startsWith("/admin")) return "管理后台";
  return "工作区";
}

/**
 * 应用 Shell：桌面端左侧固定栏 + 顶栏位置，移动端顶部 header + Sheet 抽屉。
 * 用于 (app) 路由组（需登录的产品页）。
 * 包含路由守卫：未登录时跳转到 /login。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const mounted = useMounted();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 管理后台入口：仅对管理员展示
  const visibleNav = isAdmin ? [...navItems, adminNavItem] : navItems;

  // 路由守卫：未登录跳转到 /login（带 redirect 参数）
  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [mounted, isAuthenticated, pathname, router]);

  // 等待客户端 mount 完成（避免 hydration mismatch）+ 未登录时显示 Loading
  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
      </div>
    );
  }

  const navLinkClass = (active: boolean) =>
    cn(
      "touch-target flex h-9 items-center gap-2.5 rounded-md px-3 text-small transition-colors duration-fast ease-out",
      active
        ? "bg-[var(--brand-soft)] font-medium text-primary"
        : "text-ink-700 hover:bg-card hover:text-ink-900"
    );

  // 宽栏页面：报告/导出含宽表格与图表，放宽到 max-w-6xl（与后台一致）；
  // 流程/表单类页面保持 max-w-5xl 常规栏宽，利于阅读与聚焦。
  const wideContent = /^\/projects\/[^/]+\/(report|export)/.test(pathname);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const brand = (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900 text-background">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-body font-semibold leading-tight text-ink-900">
          预演
        </span>
        <span className="block text-[11px] leading-tight text-ink-500">
          研究预演工作台
        </span>
      </span>
    </Link>
  );

  const navList = (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
        工作区
      </p>
      <ul className="space-y-0.5">
        {visibleNav.map((item) => {
          const active =
            item.href === "/projects"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={navLinkClass(active)}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const identity = (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-small font-medium text-ink-700">
          {(user?.nickname || "研").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-medium text-ink-900">
            {user?.nickname || "研究者"}
          </span>
          <span className="block text-[11px] text-ink-500">
            {PLAN_LABELS[user?.plan ?? "free"] ?? "免费版"}
          </span>
        </span>
        <ThemeToggle />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 w-full justify-start"
        onClick={handleLogout}
      >
        <LogOut className="h-3.5 w-3.5" />
        退出登录
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border bg-cream-surface md:flex">
        <div className="flex h-16 items-center border-b border-border px-4">
          {brand}
        </div>
        {navList}
        {identity}
      </aside>

      {/* 移动端顶部 header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-[var(--glass-bg)] px-4 backdrop-blur md:hidden">
        {brand}
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="打开菜单">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[280px] flex-col bg-cream-surface p-0">
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle className="sr-only">菜单</SheetTitle>
                {brand}
              </SheetHeader>
              <div className="flex flex-1 flex-col overflow-hidden">
                {navList}
                {identity}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* 桌面端顶栏：位置 + 快速新建 */}
      <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border bg-[var(--glass-bg)] px-8 backdrop-blur md:flex md:pl-[280px]">
        <div className="flex items-center gap-1.5 text-small text-ink-500">
          <span>工作区</span>
          <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
          <span className="font-medium text-ink-900">
            {sectionLabel(pathname)}
          </span>
        </div>
        <Button size="sm" asChild>
          <Link href="/projects/new">
            <Plus className="h-3.5 w-3.5" />
            新建项目
          </Link>
        </Button>
      </header>

      {/* 主内容区 */}
      <main className="md:pl-[248px]">
        <div
          className={cn(
            "mx-auto w-full px-4 py-6 md:px-8 md:py-8",
            wideContent ? "max-w-6xl" : "max-w-5xl"
          )}
        >
          {children}
        </div>

        {/* 页脚免责声明 */}
        <footer className="mt-6 border-t border-border bg-cream-surface/50 px-4 py-5 md:px-8">
          <div
            className={cn("mx-auto", wideContent ? "max-w-6xl" : "max-w-5xl")}
          >
            <Disclaimer variant="short" />
          </div>
        </footer>
      </main>
    </div>
  );
}

/** 客户端 mount 检测 hook（避免 hydration mismatch） */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
