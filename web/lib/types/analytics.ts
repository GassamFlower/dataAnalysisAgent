/** 每日指标 */
export interface DailyMetrics {
  date: string;
  registrations: number;
  reports_generated: number;
  reports_exported: number;
  payments_completed: number;
  unique_users: number;
}

/** 转化指标 */
export interface ConversionMetrics {
  register_conversion_rate: number;
  report_completion_rate: number;
  payment_conversion_rate: number;
  total_registrations: number;
  total_reports: number;
  total_payments: number;
}

/** 指标查询响应 */
export interface MetricsResponse {
  daily: DailyMetrics[];
  conversion: ConversionMetrics;
  period_days: number;
}
