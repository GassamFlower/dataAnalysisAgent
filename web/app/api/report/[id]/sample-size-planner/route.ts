import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 样本量规划 API（BFF 层，F-RPT-008）。
 * POST 转发到后端 FastAPI /api/v1/report/{project_id}/sample-size-planner。
 * 免费能力：不做配额扣减；确定性公式计算，无 LLM。
 */

interface PlannerRequest {
  analysisType: "correlation" | "t_test" | "regression";
  effectSize?: number | null;
  alpha?: number;
  power?: number;
  plannedN?: number | null;
}

interface BackendPlannerResponse {
  analysis_type: string;
  analysis_label: string;
  effect_size: number;
  effect_label: string;
  effect_source: string;
  alpha: number;
  power: number;
  required_n: number;
  per_group_n?: number | null;
  representative_min: number;
  recommended_n: number;
  planned_n?: number | null;
  verdict: string;
  verdict_label: string;
  shortfall: number;
  guidance: string[];
  one_liner: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = (await request.json().catch(() => ({}))) as PlannerRequest;

  const payload = {
    analysis_type: body.analysisType ?? "correlation",
    effect_size: body.effectSize ?? null,
    alpha: body.alpha ?? 0.05,
    power: body.power ?? 0.8,
    planned_n: body.plannedN ?? null,
  };

  const res = await fetch(
    `${BACKEND_URL}/api/v1/report/${params.id}/sample-size-planner`,
    {
      method: "POST",
      headers: {
        ...getBackendHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { code: res.status * 100, message: `后端错误: ${res.status}`, detail: text, data: null },
      { status: res.status }
    );
  }

  const json = await res.json();
  const raw = json.data as BackendPlannerResponse;

  const data = {
    analysisType: raw.analysis_type,
    analysisLabel: raw.analysis_label,
    effectSize: raw.effect_size,
    effectLabel: raw.effect_label,
    effectSource: raw.effect_source,
    alpha: raw.alpha,
    power: raw.power,
    requiredN: raw.required_n,
    perGroupN: raw.per_group_n ?? null,
    representativeMin: raw.representative_min,
    recommendedN: raw.recommended_n,
    plannedN: raw.planned_n ?? null,
    verdict: raw.verdict,
    verdictLabel: raw.verdict_label,
    shortfall: raw.shortfall,
    guidance: raw.guidance,
    oneLiner: raw.one_liner,
  };

  return NextResponse.json({ code: 0, message: "ok", data });
}
