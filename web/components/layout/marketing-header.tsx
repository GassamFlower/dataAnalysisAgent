"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  User,
  LogOut,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/example", label: "样例报告" },
  { href: "/pricing", label: "服务价格" },
  { href: "/learn", label: "统计小课堂" },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900 text-background">
        <FileText className="h-4 w-4" />
      </span>
      <span className="text-body font-semibold text-ink-900">预演</span>
      <Badge variant="outline" className="hidden font-normal sm:inline-flex">
        研究预演工具
      </Badge>
    </Link>
  );
}

export function MarketingHeader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 8);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    window.location.href = "/";
  };

  const shellClasses = cn(
    "sticky top-0 z-50 border-b transition-colors duration-base ease-out",
    scrolled
      ? "border-border bg-[var(--glass-bg)] backdrop-blur"
      : "border-transparent bg-transparent"
  );

  const navLinkClass =
    "rounded-md px-3 py-2 text-small text-ink-700 transition-colors hover:bg-secondary hover:text-ink-900";

  const authActions = () => {
    if (!mounted) {
      return (
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">登录</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/projects/new">免费体检</Link>
          </Button>
        </>
      );
    }
    if (isAuthenticated) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <User className="h-3.5 w-3.5" />
              {user?.nickname ?? "用户"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem asChild>
              <Link href="/projects" className="flex cursor-pointer items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                我的项目
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex cursor-pointer items-center gap-2 text-destructive"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return (
      <>
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">登录</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/projects/new">免费体检</Link>
        </Button>
      </>
    );
  };

  return (
    <div className={shellClasses}>
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Brand />

        {/* 桌面导航 */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass}>
              {link.label}
            </Link>
          ))}
          <span className="mx-2 h-4 w-px bg-border" aria-hidden />
          <ThemeToggle />
          <div className="ml-1 flex items-center gap-2">{authActions()}</div>
        </nav>

        {/* 移动端：CTA + 抽屉 */}
        <div className="flex items-center gap-1.5 md:hidden">
          <ThemeToggle />
          <Button size="sm" asChild>
            <Link href={mounted && isAuthenticated ? "/projects" : "/projects/new"}>
              {mounted && isAuthenticated ? "我的项目" : "免费体检"}
            </Link>
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="打开菜单">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 sm:max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left">菜单</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-0.5" aria-label="移动端导航">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className={cn(navLinkClass, "py-2.5")}
                >
                  首页
                </Link>
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(navLinkClass, "py-2.5")}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href={mounted && isAuthenticated ? "/projects" : "/login"}
                  onClick={() => setMobileOpen(false)}
                  className={cn(navLinkClass, "py-2.5")}
                >
                  {mounted && isAuthenticated ? "我的项目" : "登录"}
                </Link>
                {mounted && isAuthenticated ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-small text-destructive transition-colors hover:bg-secondary"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                ) : null}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </div>
  );
}
