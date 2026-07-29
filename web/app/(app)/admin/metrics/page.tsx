"use client";

import { useMetrics } from "@/lib/hooks/use-analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, FileText, CreditCard, Activity } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function AdminMetricsPage() {
  const { data: metrics7d, isLoading: loading7d } = useMetrics(7);
  const { data: metrics30d, isLoading: loading30d } = useMetrics(30);

  if (loading7d || loading30d) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const currentMetrics = metrics7d || metrics30d;

  if (!currentMetrics) {
    return <div className="p-6">暂无数据</div>;
  }

  const { conversion, daily } = currentMetrics;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">业务指标看板</h1>
        <p className="text-muted-foreground">核心业务指标实时监控</p>
      </div>

      {/* 转化指标卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">注册转化率</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversion.register_conversion_rate}%</div>
            <p className="text-xs text-muted-foreground">
              总注册 {conversion.total_registrations} 人
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">报告完成率</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversion.report_completion_rate}%</div>
            <p className="text-xs text-muted-foreground">
              总生成 {conversion.total_reports} 份报告
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">付费转化率</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversion.payment_conversion_rate}%</div>
            <p className="text-xs text-muted-foreground">
              总付费 {conversion.total_payments} 次
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 时间周期切换 */}
      <Tabs defaultValue="7d" className="space-y-4">
        <TabsList>
          <TabsTrigger value="7d">近 7 天</TabsTrigger>
          <TabsTrigger value="30d">近 30 天</TabsTrigger>
        </TabsList>

        <TabsContent value="7d" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>每日指标趋势</CardTitle>
              <CardDescription>近 7 天核心业务指标</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {daily.map((day) => (
                  <div key={day.date} className="flex items-center justify-between border-b pb-2">
                    <div className="font-medium">{day.date}</div>
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{day.registrations}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{day.reports_generated}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        <span>{day.payments_completed}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        <span>{day.unique_users}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="30d" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>每日指标趋势</CardTitle>
              <CardDescription>近 30 天核心业务指标</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics30d?.daily.map((day) => (
                  <div key={day.date} className="flex items-center justify-between border-b pb-2">
                    <div className="font-medium">{day.date}</div>
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{day.registrations}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{day.reports_generated}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        <span>{day.payments_completed}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        <span>{day.unique_users}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
