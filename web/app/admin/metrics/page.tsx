"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMetrics } from "@/lib/hooks/use-analytics";
import { adminApi } from "@/lib/api/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Users,
  FileText,
  CreditCard,
  Activity,
  MessagesSquare,
  FolderKanban,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PageLoading } from "@/components/admin/loading";

const QUICK_LINKS = [
  { href: "/admin/users", label: "用户与项目", desc: "查看/管理注册用户", icon: Users },
  { href: "/admin/orders", label: "订单与支付", desc: "对账与线下开通", icon: CreditCard },
  { href: "/admin/messages", label: "留言管理", desc: "待处理留言跟进", icon: MessagesSquare },
  { href: "/admin/configs", label: "配置与配额", desc: "运行时配额调整", icon: TrendingUp },
  { href: "/admin/audit-logs", label: "审计日志", desc: "管理员操作留痕", icon: Activity },
];

export default function AdminMetricsPage() {
  const { data: metrics7d, isLoading: loading7d } = useMetrics(7);
  const { data: metrics30d, isLoading: loading30d } = useMetrics(30);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["admin-dashboard-overview"],
    queryFn: () => adminApi.getDashboardOverview(),
  });

  if (loading7d || loading30d || loadingOverview) {
    return <PageLoading />;
  }

  const currentMetrics = metrics7d || metrics30d;

  if (!currentMetrics) {
    return <div className="py-10 text-center text-sm text-muted-foreground">暂无数据</div>;
  }

  const { conversion, daily } = currentMetrics;

  return (
    <div className="space-y-6">
      <PageHeader
        title="运营概览"
        description="核心业务指标 + 各管理模块快捷入口"
      />

      {/* 快捷入口 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <div className="flex items-center gap-2">
              <q.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-ink-900">{q.label}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{q.desc}</div>
            <div className="mt-2 flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
              前往 <ArrowRight className="h-3 w-3" />
            </div>
          </Link>
        ))}
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

      {/* 运营维度补充（套餐分布 / 项目规模 / 活跃 / 留言待办） */}
      {overview && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">套餐分布</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span>总用户</span>
                <span className="font-semibold">{overview.total_users}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>免费 / 单次 / 订阅</span>
                <span className="font-medium text-ink-900">
                  {overview.plan_distribution.free}
                  {" / "}
                  {overview.plan_distribution.single}
                  {" / "}
                  {overview.plan_distribution.subscription}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">项目规模</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span>项目总数</span>
                <span className="font-semibold">{overview.total_projects}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>真实 / 模拟</span>
                <span className="font-medium text-ink-900">
                  {overview.projects_by_mode.real}
                  {" / "}
                  {overview.projects_by_mode.simulation}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>近 7 天活跃用户</span>
                <span className="font-medium text-ink-900">{overview.active_users_7d}</span>
              </div>
            </CardContent>
          </Card>

          <Link href="/admin/messages">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">留言待办</CardTitle>
                <MessagesSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.pending_messages}</div>
                <p className="text-xs text-muted-foreground">
                  待处理留言 · 点击前往处理
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

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
                {(metrics30d?.daily ?? []).map((day) => (
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
