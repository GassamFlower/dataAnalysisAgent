/**
 * 前端埋点工具
 * 用于追踪核心业务指标：注册转化率、报告完成率、付费转化率
 */

export type EventType =
  // 注册相关
  | 'register_page_view'
  | 'register_start'
  | 'register_verify_code_sent'
  | 'register_success'
  | 'register_fail'
  // 报告相关
  | 'report_page_view'
  | 'report_analyze_start'
  | 'report_analyze_success'
  | 'report_analyze_fail'
  | 'report_export_start'
  | 'report_export_success'
  | 'report_export_fail'
  // 付费相关
  | 'pricing_page_view'
  | 'pricing_plan_select'
  | 'payment_start'
  | 'payment_success'
  | 'payment_fail'
  // 项目相关
  | 'project_create'
  | 'project_view'
  | 'questionnaire_upload'
  | 'inspection_start'
  | 'inspection_success'
  | 'simulation_start'
  | 'simulation_success';

export interface EventData {
  event: EventType;
  project_id?: string;
  user_id?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * 发送埋点事件到后端
 */
export async function trackEvent(
  event: EventType,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const eventData: EventData = {
      event,
      metadata,
      timestamp: Date.now(),
    };

    // 尝试从 localStorage 获取用户信息
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          eventData.user_id = user.id;
        } catch {}
      }

      // 尝试从 URL 获取项目 ID
      const match = window.location.pathname.match(/\/projects\/([^/]+)/);
      if (match) {
        eventData.project_id = match[1];
      }
    }

    // 发送到后端埋点接口
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
      keepalive: true,
    });
  } catch (error) {
    // 埋点失败不应影响用户体验，静默处理
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Track failed:', error);
    }
  }
}

/**
 * 页面浏览埋点（自动调用）
 */
export function trackPageView(path: string): void {
  trackEvent('register_page_view', { path });
}

/**
 * 注册流程埋点
 */
export const registerAnalytics = {
  pageView: () => trackEvent('register_page_view'),
  start: () => trackEvent('register_start'),
  verifyCodeSent: () => trackEvent('register_verify_code_sent'),
  success: (userId: string) => trackEvent('register_success', { user_id: userId }),
  fail: (reason: string) => trackEvent('register_fail', { reason }),
};

/**
 * 报告流程埋点
 */
export const reportAnalytics = {
  pageView: () => trackEvent('report_page_view'),
  analyzeStart: () => trackEvent('report_analyze_start'),
  analyzeSuccess: (reportId: string) =>
    trackEvent('report_analyze_success', { report_id: reportId }),
  analyzeFail: (reason: string) => trackEvent('report_analyze_fail', { reason }),
  exportStart: (format: string) => trackEvent('report_export_start', { format }),
  exportSuccess: (format: string) => trackEvent('report_export_success', { format }),
  exportFail: (format: string, reason: string) =>
    trackEvent('report_export_fail', { format, reason }),
};

/**
 * 付费流程埋点
 */
export const paymentAnalytics = {
  pageView: () => trackEvent('pricing_page_view'),
  planSelect: (plan: string) => trackEvent('pricing_plan_select', { plan }),
  start: (plan: string) => trackEvent('payment_start', { plan }),
  success: (orderId: string, plan: string) =>
    trackEvent('payment_success', { order_id: orderId, plan }),
  fail: (reason: string) => trackEvent('payment_fail', { reason }),
};

/**
 * 项目流程埋点
 */
export const projectAnalytics = {
  create: () => trackEvent('project_create'),
  view: (projectId: string) => trackEvent('project_view', { project_id: projectId }),
  questionnaireUpload: () => trackEvent('questionnaire_upload'),
  inspectionStart: () => trackEvent('inspection_start'),
  inspectionSuccess: () => trackEvent('inspection_success'),
  simulationStart: () => trackEvent('simulation_start'),
  simulationSuccess: () => trackEvent('simulation_success'),
};
