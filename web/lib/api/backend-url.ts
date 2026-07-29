/**
 * BFF 层后端地址集中管理（唯一来源）。
 *
 * 仅用于 app/api/** 下的 route handler（服务端运行），
 * 浏览器端请使用 lib/api/client.ts 中的 API_BASE。
 *
 * 修改 BACKEND_URL 时只需调整此文件或对应环境变量，
 * 禁止在各 route.ts 中重复定义。
 */
export const BACKEND_URL =
  process.env.BACKEND_URL ?? "http://localhost:8000";
