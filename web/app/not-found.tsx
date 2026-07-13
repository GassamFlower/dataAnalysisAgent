import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream-muted text-ink-500">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-h1 font-bold text-ink-900">404</h1>
      <p className="mt-2 text-body text-ink-500">页面不存在或已被移除</p>
      <Button asChild className="mt-6">
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}
