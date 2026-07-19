"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, LayoutDashboard } from "lucide-react";

export function MarketingHeader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // SSR 时显示默认状态（未登录），避免 hydration mismatch
  if (!mounted) {
    return (
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-bold text-ink-900">预演</span>
          <Badge variant="outline" className="font-normal text-ink-500">
            研究预演工具
          </Badge>
        </div>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pricing">定价</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
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
      <div className="flex items-center gap-2">
        <span className="font-display text-xl font-bold text-ink-900">预演</span>
        <Badge variant="outline" className="font-normal text-ink-500">
          研究预演工具
        </Badge>
      </div>
      <nav className="flex items-center gap-2">
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
                onClick={() => {
                  logout();
                  window.location.href = "/";
                }}
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
    </header>
  );
}
