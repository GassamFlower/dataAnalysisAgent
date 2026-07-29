import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 应用内受保护路由不应被索引
        disallow: ["/projects/", "/settings", "/api/"],
      },
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/about", "/learn"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
