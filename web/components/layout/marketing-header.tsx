"use client";

import { useState, useEffect } from "react";
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
import { User, LogOut, LayoutDashboard, Menu } from "lucide-react";

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/" className="flex items-center gap-2">
        <span className="font-display text-xl font-bold text-ink-900">预演</span>
      </Link>
      <Badge variant="outline" className="hidden font-normal text-ink-500 sm:inline-flex">
        研究预演工具
      </Badge>
    </div>
  );
}

export function MarketingHeader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    window.location.href = "/";
  };

  const navLinks = [
    { href: "/pricing", label: "定价" },
    { href: "/about", label: "关于" },
  ];

  // SSR 时显示默认状态（未登录），避免 hydration mismatch
  if (!mounted) {
    return (
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Brand />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/pricing">定价</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/about">关于</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">登录</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/projects/new">免费体检</Link>
          </Button>
        </nav>
      </header>
    );
  }

  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
      <Brand />

      {/* 桌面导航 */}
      <nav className="hidden items-center gap-2 md:flex">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pricing">定价</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/about">关于</Link>
        </Button>
        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <User className="mr-1.5 h-3.5 w-3.5" />
                {user?.nickname ?? "用户"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href="/projects" className="flex items-center gap-2 cursor-pointer">
                  <LayoutDashboard className="h-4 w-4" />
                  我的项目
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 cursor-pointer text-destructive"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">登录</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/projects/new">免费体检</Link>
            </Button>
          </>
        )}
      </nav>

      {/* 移动端：汉堡菜单（保持 CTA 可见） */}
      <div className="flex items-center gap-2 md:hidden">
        <Button size="sm" asChild>
          <Link href={isAuthenticated ? "/projects" : "/projects/new"}>
            {user?.nickname ? "我的项目" : "免费体检"}
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
            <nav className="mt-6 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Button
                  key={l.href}
                  variant="ghost"
                  size="lg"
                  asChild
                  className="justify-start"
                  onClick={() => setMobileOpen(false)}
                >
                  <Link href={l.href}>{l.label}</Link>
                </Button>
              ))}
              <Button
                variant="ghost"
                size="lg"
                asChild
                className="justify-start"
                onClick={() => setMobileOpen(false)}
              >
                <Link href={isAuthenticated ? "/projects" : "/login"}>
                  {isAuthenticated ? "我的项目" : "登录"}
                </Link>
              </Button>
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  size="lg"
                  className="justify-start text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </Button>
              ) : null}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
