"use client";

import { useQuery } from "@tanstack/react-query";

import { scalesApi, type ScaleListParams } from "@/lib/api/scales";

/** 学科量表库列表（公开） */
export function useScales(params: ScaleListParams = {}) {
  const discipline = params.discipline ?? "";
  const keyword = params.keyword ?? "";
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 12;

  return useQuery({
    queryKey: ["scales", discipline, keyword, page, pageSize],
    queryFn: () =>
      scalesApi.list({
        discipline: discipline || undefined,
        keyword: keyword || undefined,
        page,
        page_size: pageSize,
      }),
    placeholderData: (prev) => prev,
  });
}