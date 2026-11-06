import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface ArticleSlug {
  slug: string;
  updated_at?: string;
}

interface ArticlesResponse {
  items: ArticleSlug[];
  total: number;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/example`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/learn`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/learn/scales`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/learn/tools/sample-size`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  let articleEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${SITE_URL}/api/v1/tutorial/articles?page_size=200`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data: ArticlesResponse = await res.json();
      articleEntries = data.items.map((article) => ({
        url: `${SITE_URL}/learn/${article.slug}`,
        lastModified: article.updated_at ? new Date(article.updated_at) : now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    }
  } catch {
    // API 不可用时仅返回静态条目
  }

  return [...staticEntries, ...articleEntries];
}
