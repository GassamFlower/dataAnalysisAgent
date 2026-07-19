/** 用户个人中心 TanStack Query hooks。 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi, type User } from "@/lib/api/users";

/** 获取当前用户信息 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: () => usersApi.getMe(),
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

/** 修改昵称 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nickname: string) => usersApi.updateProfile(nickname),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
}

/** 修改密码 */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: ({ old_password, new_password }: { old_password: string; new_password: string }) =>
      usersApi.updatePassword(old_password, new_password),
  });
}

/** 发送新邮箱验证码 */
export function useRequestEmailChange() {
  return useMutation({
    mutationFn: (new_email: string) => usersApi.requestEmailChange(new_email),
  });
}

/** 验证并更新邮箱 */
export function useConfirmEmailChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ new_email, code }: { new_email: string; code: string }) =>
      usersApi.confirmEmailChange(new_email, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
}

/** 上传头像 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
}
