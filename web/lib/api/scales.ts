/**
 * 学科量表库 API 层（走 BFF /api/v1/scales 通用转发）。
 * 公开列表，无需登录；供量表库页面展示与"一键建项目"联动。
 */

import { apiClient } from "@/lib/api/client";
import type { ScaleListResponse, ScaleListItem } from "@/types";

/** 后端返回的原始 snake_case 结构 */
interface ScaleListRaw {
  items: Array<{
    id: string;
    slug: string;
    name: string;
    discipline: ScaleListItem["discipline"];
    description?: string;
    source?: string;
    reliability_ref?: string;
    validity_ref?: string;
  }>;
  total: number;
  page: number;
  page_size: number;
}

export interface ScaleListParams {
  discipline?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}

function normalizeItem(raw: ScaleListRaw["items"][number]): ScaleListItem {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    discipline: raw.discipline,
    description: raw.description,
    source: raw.source,
    reliabilityRef: raw.reliability_ref,
    validityRef: raw.validity_ref,
  };
}

export const scalesApi = {
  list: async (params: ScaleListParams = {}): Promise<ScaleListResponse> => {
    const raw = await apiClient.get<ScaleListRaw>("/api/v1/scales", {
      params: {
        ...(params.discipline ? { discipline: params.discipline } : {}),
        ...(params.keyword ? { keyword: params.keyword } : {}),
        page: params.page ?? 1,
        page_size: params.page_size ?? 12,
      },
    });
    return {
      items: raw.items.map(normalizeItem),
      total: raw.total,
      page: raw.page,
      pageSize: raw.page_size,
    };
  },
};