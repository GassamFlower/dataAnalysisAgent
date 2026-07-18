import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";

/**
 * 报告 API（BFF 层）。
 * GET 转发到后端 FastAPI /api/v1/report/{project_id}，做 snake→camel 转换。
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

function toNumber(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? fallback : n;
}

interface BackendReliability {
  dimension: string;
  alpha: string | number;
  kmo: string | number;
  bartlett_p_value: string | number;
  passed: boolean;
  alpha_grade?: string;
  alpha_wording?: string;
  kmo_grade?: string;
  kmo_wording?: string;
  bartlett_grade?: string;
  bartlett_wording?: string;
}

interface BackendIssue {
  dimension: string;
  metric: string;
  value: string | number;
  threshold: string | number;
  reason: string;
  suggestion: string;
}

interface BackendDiffTest {
  predictor: string;
  outcome: string;
  method?: string | null;
  method_name?: string | null;
  iv_type?: string;
  dv_type?: string;
  group_count?: number | null;
  statistic?: number | null;
  p_value?: number | null;
  effect_size?: number | null;
  effect_size_name?: string;
  effect_size_grade?: string;
  significant?: boolean;
  interpretation?: string;
  error?: string;
}

interface BackendReport {
  id: string;
  project_id: string;
  overall_alpha?: string | number | null;
  passed_count?: number | null;
  total_count?: number | null;
  reliability_results?: BackendReliability[];
  diagnosis?: {
    passed: boolean;
    issues?: BackendIssue[];
  } | null;
  diff_tests?: BackendDiffTest[] | null;
  sample_size?: number | null;
  created_at: string;
}

function transformReport(raw: BackendReport) {
  if (!raw) return null;
  return {
    id: raw.id,
    projectId: raw.project_id,
    overallAlpha: toNumber(raw.overall_alpha),
    passedCount: raw.passed_count ?? 0,
    totalCount: raw.total_count ?? 0,
    reliability: (raw.reliability_results ?? []).map((r) => ({
      dimension: r.dimension,
      alpha: toNumber(r.alpha),
      kmo: toNumber(r.kmo),
      bartlettPValue: toNumber(r.bartlett_p_value),
      passed: r.passed,
      alphaGrade: r.alpha_grade,
      alphaWording: r.alpha_wording,
      kmoGrade: r.kmo_grade,
      kmoWording: r.kmo_wording,
      bartlettGrade: r.bartlett_grade,
      bartlettWording: r.bartlett_wording,
    })),
    diagnosis: raw.diagnosis
      ? {
          passed: raw.diagnosis.passed,
          issues: (raw.diagnosis.issues ?? []).map((i) => ({
            dimension: i.dimension,
            metric: i.metric,
            value: toNumber(i.value),
            threshold: toNumber(i.threshold),
            reason: i.reason,
            suggestion: i.suggestion,
          })),
        }
      : { passed: true, issues: [] },
    diffTests: raw.diff_tests
      ? raw.diff_tests.map((t) => ({
          predictor: t.predictor,
          outcome: t.outcome,
          method: t.method,
          methodName: t.method_name,
          ivType: t.iv_type,
          dvType: t.dv_type,
          groupCount: t.group_count,
          statistic: t.statistic,
          pValue: t.p_value,
          effectSize: t.effect_size,
          effectSizeName: t.effect_size_name,
          effectSizeGrade: t.effect_size_grade,
          significant: t.significant,
          interpretation: t.interpretation,
          error: t.error,
        }))
      : null,
    sampleSize: raw.sample_size ?? undefined,
    createdAt: raw.created_at,
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/report/${params.id}`, {
    headers: getBackendHeaders(request),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `后端错误: ${res.status}`, detail: text },
      { status: res.status }
    );
  }

  const json = await res.json();
  const report = transformReport(json.data as BackendReport);
  if (!report) {
    return NextResponse.json(
      { code: 404, message: "未找到报告", data: null },
      { status: 404 }
    );
  }
  return NextResponse.json({ code: 0, message: "ok", data: report });
}
