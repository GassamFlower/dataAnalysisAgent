import { NextResponse } from "next/server";
import { getBackendHeaders } from "@/lib/server/auth";
import type { Project, ProjectOverview } from "@/types";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * 单个项目 API（BFF 层）。
 * GET 转发到后端 /api/v1/projects/{id}，做 snake→camel 转换。
 * DELETE 转发到后端 /api/v1/projects/{id}（返回 204）。
 */

interface BackendDatasetOverview {
  source: "real" | "simulation" | null;
  sample_size: number | null;
  imported_at: string | null;
}

interface BackendReportOverview {
  has_report: boolean;
  overall_alpha: number | null;
  passed_count: number | null;
  total_count: number | null;
  generated_at: string | null;
}

interface BackendOverview {
  question_count: number;
  dimension_count: number;
  reverse_count: number;
  dataset: BackendDatasetOverview;
  report: BackendReportOverview;
}

interface BackendProject {
  id: string;
  user_id: string;
  name: string;
  mode: "real" | "simulation";
  status: string;
  created_at: string;
  updated_at: string;
  overview: BackendOverview;
}

function transformOverview(raw: BackendOverview): ProjectOverview {
  return {
    questionCount: raw.question_count,
    dimensionCount: raw.dimension_count,
    reverseCount: raw.reverse_count,
    dataset: {
      source: raw.dataset.source,
      sampleSize: raw.dataset.sample_size,
      importedAt: raw.dataset.imported_at,
    },
    report: {
      hasReport: raw.report.has_report,
      overallAlpha: raw.report.overall_alpha,
      passedCount: raw.report.passed_count,
      totalCount: raw.report.total_count,
      generatedAt: raw.report.generated_at,
    },
  };
}

function transformProject(raw: BackendProject): Project {
  return {
    id: raw.id,
    name: raw.name,
    mode: raw.mode,
    status: raw.status as Project["status"],
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    overview: transformOverview(raw.overview),
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/projects/${params.id}`, {
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
  const project = transformProject(json.data as BackendProject);
  return NextResponse.json({ code: 0, message: "success", data: project });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/v1/projects/${params.id}`, {
    method: "PATCH",
    headers: {
      ...getBackendHeaders(request),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
  const project = transformProject(json.data as BackendProject);
  return NextResponse.json({ code: 0, message: "success", data: project });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/projects/${params.id}`, {
    method: "DELETE",
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

  return NextResponse.json({ code: 0, message: "success", data: { success: true, id: params.id } });
}
