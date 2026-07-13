import { Badge } from "@/components/ui/badge";
import { CONFIDENCE_LABELS } from "@/lib/constants";
import type { Question } from "@/types";

/**
 * 维度归属置信度标签（宪法第 13 条：透明展示）。
 * 明确归属 vs 存疑待确认。
 */
export function ConfidenceTag({ confidence }: { confidence: Question["confidence"] }) {
  const cfg = CONFIDENCE_LABELS[confidence];
  return (
    <Badge variant={cfg.tone} className="font-normal">
      {cfg.label}
    </Badge>
  );
}
