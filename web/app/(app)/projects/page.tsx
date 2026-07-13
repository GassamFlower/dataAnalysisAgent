import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { ProjectsList } from "./projects-list";

export const metadata = { title: "我的项目" };

export default function ProjectsPage() {
  return (
    <div>
      <PageHeader
        title="我的项目"
        description="管理你的问卷研究预演项目。"
        actions={
          <Button asChild>
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
