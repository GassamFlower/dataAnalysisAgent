import { AppShell } from "@/components/layout/app-shell";

/**
 * (app) 路由组布局：应用 Shell。
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
