"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getHealth } from "@/lib/api/health";

/**
 * 示例路由页。
 * 验证 Card、Input、Button 组件与 apiClient 的示例请求。
 */
export default function ExamplePage() {
  const [result, setResult] = useState<string>("点击按钮发起请求");
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    setLoading(true);
    try {
      const data = await getHealth();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="font-display text-2xl">示例路由</CardTitle>
          <CardDescription>验证 UI 组件库与接口层封装</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="请输入内容测试 Input 组件" />
          <div className="flex items-center gap-3">
            <Button onClick={handleRequest} disabled={loading}>
              {loading ? "请求中..." : "发送示例请求"}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
          <pre className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
            {result}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
