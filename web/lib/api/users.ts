/** 用户个人中心接口。 */
import { apiClient } from "./client";

export interface User {
  id: string;
  email: string | null;
  nickname: string | null;
  avatar: string | null;
  email_verified: boolean;
  plan: "free" | "single" | "subscription";
  plan_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const usersApi = {
  /** 获取当前用户信息 */
  getMe: () => apiClient.get<User>("/api/users/me"),

  /** 修改昵称 */
  updateProfile: (nickname: string) =>
    apiClient.patch<{ nickname: string }>("/api/users/me/profile", { nickname }),

  /** 修改密码 */
  updatePassword: (old_password: string, new_password: string) =>
    apiClient.patch<null>("/api/users/me/password", { old_password, new_password }),

  /** 发送新邮箱验证码 */
  requestEmailChange: (new_email: string) =>
    apiClient.post<{ new_email: string }>("/api/users/me/email/change-request", { new_email }),

  /** 验证并更新邮箱 */
  confirmEmailChange: (new_email: string, code: string) =>
    apiClient.post<null>("/api/users/me/email/change-confirm", { new_email, code }),

  /** 上传头像（返回 data URI） */
  uploadAvatar: async (file: File): Promise<{ avatar: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/users/me/avatar", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(json.message || "头像上传失败");
    }
    return json.data;
  },
};
