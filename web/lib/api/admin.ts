/**
 * 管理后台 API（F-ADM-001 ~ F-ADM-005）。
 * 通过 /api/v1/* catch-all BFF 代理转发，后端 require_admin 门禁。
 */
import { apiClient } from "./client";

export interface AdminUser {
  id: string;
  email: string | null;
  email_masked?: string | null;
  nickname: string | null;
  plan: "free" | "single" | "subscription";
  plan_expires_at?: string | null;
  is_admin: boolean;
  email_verified: boolean;
  disabled: boolean;
  disabled_at?: string | null;
  created_at?: string | null;
  project_count?: number;
  projects?: AdminProject[];
}

export interface AdminProject {
  id: string;
  name: string;
  mode: "real" | "simulation";
  status: string;
  created_at?: string | null;
}

export interface AdminOrder {
  id: string;
  type: "single" | "subscription";
  amount: string;
  status: "pending" | "paid" | "refunded" | "cancelled";
  paid_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  user_id: string;
  user_email?: string | null;
}

export interface AdminAuditLog {
  id: string;
  user_id: string;
  project_id?: string | null;
  action_type: string;
  action_detail?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at?: string | null;
}

/** 留言处理状态 */
export type AdminMessageStatus = "pending" | "processing" | "done";

/** 管理员视角留言项（对应后端 admin._msg_serialize） */
export interface AdminMessage {
  id: string;
  user_id: string;
  user_email?: string | null;
  user_nickname?: string | null;
  project_id?: string | null;
  tag: string;
  tag_label: string;
  data_source?: string | null;
  data_source_label?: string | null;
  entry_point?: string | null;
  contact?: string | null;
  content: string;
  status: AdminMessageStatus;
  status_label: string;
  handled_by?: string | null;
  handled_at?: string | null;
  handle_remark?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export const adminApi = {
  /** 用户分页列表 */
  listUsers: (params: {
    keyword?: string;
    plan?: string;
    disabled?: boolean;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<Paginated<AdminUser>>("/api/v1/admin/users", { params }),

  /** 用户详情 + 项目列表 */
  getUser: (id: string) =>
    apiClient.get<AdminUser & { projects: AdminProject[] }>(
      `/api/v1/admin/users/${id}`
    ),

  /** 线下开通：为指定用户创建线下已支付订单并激活套餐 */
  createOfflineOrder: (body: {
    user_id: string;
    plan_type: "single" | "subscription";
    days?: number;
    channel?: string;
    remark?: string;
    amount?: number;
  }) => apiClient.post<AdminUser & { order?: Record<string, unknown> }>(
    "/api/v1/admin/orders",
    body
  ),

  /** 调整用户套餐 */
  changePlan: (
    id: string,
    body: { plan: string; expires_at?: string | null }
  ) =>
    apiClient.patch<AdminUser>(`/api/v1/admin/users/${id}/plan`, body),

  /** 禁用/启用用户 */
  setDisabled: (id: string, disabled: boolean) =>
    apiClient.patch<AdminUser>(`/api/v1/admin/users/${id}/disabled`, {
      disabled,
    }),

  /** 订单分页列表 */
  listOrders: (params: { status?: string; page?: number; page_size?: number }) =>
    apiClient.get<Paginated<AdminOrder>>("/api/v1/admin/orders", { params }),

  /** 订单详情 */
  orderDetail: (id: string) =>
    apiClient.get<AdminOrder>(`/api/v1/admin/orders/${id}`),

  /** 审计日志分页列表 */
  listAuditLogs: (params: {
    action_type?: string;
    user_id?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<Paginated<AdminAuditLog>>("/api/v1/admin/audit-logs", {
      params,
    }),

  /** 留言分页列表（支持分类/状态/数据源/关键词筛选） */
  listMessages: (params: {
    tag?: string;
    status?: string;
    data_source?: string;
    keyword?: string;
    page?: number;
    page_size?: number;
  }) => apiClient.get<Paginated<AdminMessage>>("/api/v1/admin/messages", { params }),

  /** 更新留言处理状态 + 处理备注 */
  updateMessageStatus: (
    messageId: string,
    body: { status: AdminMessageStatus; handle_remark?: string | null }
  ) =>
    apiClient.patch<AdminMessage>(
      `/api/v1/admin/messages/${messageId}/status`,
      body
    ),
};