import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { ProjectsList } from "./projects-list";

export const metadata = { title: "我的项目" };

export default function ProjectsPage() {
  return (
    <div>
      {/* 桌面端顶栏已有全局新建入口，此处仅在移动端补充，避免同屏三个重复按钮 */}
      <PageHeader
        title="我的项目"
        description="管理你的问卷研究预演项目。"
        actions={
          <Button asChild className="md:hidden">
            <Link href="/projects/new">
              <Plus className="mr-1.5 h-4 w-4" />
              新建项目
            </Link>
          </Button>
        }
      />

      <ProjectsList />
    </div>
  );
}
