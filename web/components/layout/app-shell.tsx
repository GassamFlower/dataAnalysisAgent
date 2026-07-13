"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plus, Settings, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/projects", label: "我的项目", icon: LayoutDashboard },
  { href: "/projects/new", label: "新建项目", icon: Plus },
  { href: "/settings", label: "设置", icon: Settings },
];

/**
 * 应用 Shell：左侧栏 + 主内容区。
 * 用于 (app) 路由组（需登录的产品页）。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 w-60 border-r border-border bg-cream-surface">
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
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast ease-out",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-ink-700 hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="pl-60">
        <div className="mx-auto max-w-4xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
