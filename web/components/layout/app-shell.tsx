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

const navItems = [
  { href: "/projects", label: "我的项目", icon: LayoutDashboard },
  { href: "/projects/new", label: "新建项目", icon: Plus },
  { href: "/settings", label: "设置", icon: Settings },
];

/**
 * 应用 Shell：桌面端左侧固定栏，移动端顶部 header + Sheet 抽屉。
 * 用于 (app) 路由组（需登录的产品页）。
 * 包含路由守卫：未登录时跳转到 /login。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mounted = useMounted();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
      </div>
    );
  }

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast ease-out",
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-ink-700 hover:bg-accent hover:text-accent-foreground"
    );

  return (
    <div className="min-h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-cream-surface md:block">
        <div className="flex h-16 items-center px-6">
          <Link href="/" className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold text-ink-900">
              预演
            </span>
          </Link>
        </div>
        <nav className="px-3 py-4">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className={navLinkClass(active)}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 移动端顶部 header */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-cream-surface px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-bold text-ink-900">预演</span>
        </Link>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="打开菜单">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-cream-surface p-0">
            <SheetHeader className="border-b border-border p-6 text-left">
              <SheetTitle className="font-display text-lg text-ink-900">预演</SheetTitle>
            </SheetHeader>
            <nav className="px-3 py-4">
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass(active)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* 主内容区 */}
      <main className="pt-16 md:pl-60 md:pt-0">
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
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
