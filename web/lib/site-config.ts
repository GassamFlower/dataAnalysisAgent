/**
 * 站点对外信息。备案号、营业执照、小红书店铺地址等按环境变量注入，
 * 未配置时对应位置不渲染，避免上线后出现占位文案。
 */
export const SITE = {
  name: "预演",
  tagline: "研究预演工作台",
  entity: "预演（个体工商户）",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** 小红书店铺地址；配置后服务价格页按钮直接跳转 */
  xhsShopUrl: process.env.NEXT_PUBLIC_XHS_SHOP_URL ?? "",
  /** 小红书店铺名称，未配置地址时提示用户搜索 */
  xhsShopName: process.env.NEXT_PUBLIC_XHS_SHOP_NAME ?? "预演研究",
  /** ICP 备案号，例如 浙ICP备2026000000号-1 */
  icp: process.env.NEXT_PUBLIC_ICP_NUMBER ?? "",
  /** 公安联网备案号 */
  police: process.env.NEXT_PUBLIC_POLICE_NUMBER ?? "",
  /** 营业执照注册号（亮照用） */
  businessLicense: process.env.NEXT_PUBLIC_BUSINESS_LICENSE ?? "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
} as const;
