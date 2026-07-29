/**
 * 认证相关 Cookie 名称与有效期集中管理（唯一来源）。
 *
 * 涉及文件：
 * - web/middleware.ts: 路由保护，读取 auth-token
 * - web/app/api/auth/_utils.ts: 登录回调写入 / 登出清除
 * - web/app/api/auth/callback/route.ts: 微信回调写入
 * - web/app/api/users/me/ 子路由: BFF 转发后端时读取
 * - web/lib/stores/auth-store.ts: 客户端双写 cookie
 *
 * 禁止在各处重复定义 "auth-token" / "refresh-token" 字面量或本地常量。
 */

/** access token cookie 名（供 middleware 路由保护读取） */
export const AUTH_COOKIE_NAME = "auth-token";

/** refresh token cookie 名（httpOnly，仅供 BFF 续期接口读取） */
export const REFRESH_COOKIE_NAME = "refresh-token";

/**
 * access token cookie 保留时长。
 * access token 本身只有 15 分钟有效期，但 cookie 作为"已登录"标记随 refresh token 一起保留 7 天，
 * 供 middleware 做路由保护；实际接口鉴权仍以后端校验 access token 为准。
 */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

/** refresh token cookie 保留时长（与 access token cookie 同步） */
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
