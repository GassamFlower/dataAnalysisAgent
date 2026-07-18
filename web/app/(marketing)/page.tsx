import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * 首页占位页。
 * 仅展示品牌标题与骨架功能入口，不写业务内容。
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <CardTitle className="font-display text-3xl">数据分析智能体</CardTitle>
          <CardDescription>前端骨架已搭好</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-body text-muted-foreground">
            这是一个占位首页，用于验证项目启动、设计 token 与 UI 组件库。
          </p>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/example">查看示例页</Link>
            </Button>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
