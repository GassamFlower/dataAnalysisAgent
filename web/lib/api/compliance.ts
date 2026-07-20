/**
 * 合规 API 客户端。
 *
 * 处理用户协议、学术诚信承诺等合规相关操作。
 */

import { apiClient } from "./client";

/** 协议类型 */
export type AgreementType = "terms_of_service" | "academic_integrity" | "simulation_disclaimer";

/** 模拟数据承诺检查响应 */
export interface SimulationDisclaimerCheckResponse {
  has_agreed: boolean;
  agreement_version: string;
}

/** 用户协议状态 */
export interface AgreementsStatusResponse {
  agreements: Record<
    AgreementType,
    {
      version: string;
      agreed_at: string | null;
    }
  >;
}

export const complianceApi = {
  /** 检查用户是否已同意模拟数据承诺 */
  checkSimulationDisclaimer: (): Promise<SimulationDisclaimerCheckResponse> =>
    apiClient.get<SimulationDisclaimerCheckResponse>(
      "/api/compliance/simulation-disclaimer/check"
    ),

  /** 记录用户同意模拟数据承诺 */
  confirmSimulationDisclaimer: (): Promise<{ message: string }> =>
    apiClient.post<{ message: string }>(
      "/api/compliance/simulation-disclaimer/confirm"
    ),

  /** 获取用户所有协议同意状态 */
  getAgreementsStatus: (): Promise<AgreementsStatusResponse> =>
    apiClient.get<AgreementsStatusResponse>("/api/compliance/agreements/status"),
};
