import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface ArticleResponse {
  id: string;
  slug: string;
  title: string;
  category: string;
  content_markdown: string;
  summary: string | null;
  tags?: string[] | null;
  difficulty?: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const fallback: Metadata = {
    title: "教程详情 · 统计知识小课堂",
    description: "问卷分析教程，从统计基础到论文写作。",
  };

  try {
    const res = await fetch(`${SITE_URL}/api/v1/tutorial/articles/${params.slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return fallback;

    const article: ArticleResponse = await res.json();
    const title = `${article.title} · 统计知识小课堂`;
    const description =
      article.summary ||
      `学习「${article.title}」——问卷数据分析必备知识，免费阅读本文。`;

    return {
      title,
      description,
      keywords: article.tags ?? [],
      openGraph: {
        title,
        description,
        type: "article",
        tags: article.tags ?? [],
      },
    };
  } catch {
    return fallback;
  }
}

export default function TutorialDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
