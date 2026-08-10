import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 样本代表性诊断 API（BFF 层，F-RPT-007）。
 * GET 转发到后端 FastAPI /api/v1/report/{project_id}/sample-representativeness。
 * 免费能力：不做配额扣减。
 */

interface BackendSampleRep {
  supported: boolean;
  message?: string;
  sample_size?: number;
  has_demographic?: boolean;
  overall_score?: number;
  grade?: string;
  summary?: string;
  distributions?: Array<{
    index: number;
    text: string;
    label: string;
    counts: Record<string, number>;
    total: number;
    top_category: string;
    top_share: number;
  }>;
  items?: Array<{
    key: string;
    title: string;
    status: "pass" | "warn" | "fail";
    message: string;
    suggestion?: string;
  }>;
  ai_conclusion?: string;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/report/${params.id}/sample-representativeness`,
    {
      headers: getBackendHeaders(request),
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
  const raw = json.data as BackendSampleRep;

  const data = {
    supported: raw.supported,
    message: raw.message ?? "",
    sampleSize: raw.sample_size ?? 0,
    hasDemographic: raw.has_demographic ?? false,
    overallScore: raw.overall_score ?? 0,
    grade: raw.grade ?? "C",
    summary: raw.summary ?? "",
    distributions: (raw.distributions ?? []).map((d) => ({
      index: d.index,
      text: d.text,
      label: d.label,
      counts: d.counts,
      total: d.total,
      topCategory: d.top_category,
      topShare: d.top_share,
    })),
    items: (raw.items ?? []).map((it) => ({
      key: it.key,
      title: it.title,
      status: it.status,
      message: it.message,
      suggestion: it.suggestion ?? "",
    })),
    aiConclusion: raw.ai_conclusion ?? "",
  };

  return NextResponse.json({ code: 0, message: "ok", data });
}
