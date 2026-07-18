/**
 * 环境判断工具。
 * 统一封装 NODE_ENV 判断，避免业务代码直接依赖 process.env。
 */

/** 是否为生产环境 */
export const isProduction = process.env.NODE_ENV === "production";

/** 是否为开发环境（包含 development 与 test，以及 Next.js 未显式设置 production 的情况） */
export const isDevelopment = !isProduction;
