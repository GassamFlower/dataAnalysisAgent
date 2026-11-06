/** 文字体检（去 AI 味）类型，对应 server/app/schemas/ai_tone.py */

export interface AiToneExample {
  line: number;
  excerpt: string;
}

export interface AiToneRuleItem {
  id: string;
  name: string;
  count: number;
  density: number;
  reference: string;
  advice: string;
  examples: AiToneExample[];
}

export interface AiToneGroup {
  level: "A" | "B" | "X" | "H";
  title: string;
  items: AiToneRuleItem[];
}

export interface AiToneFingerprint {
  key: string;
  label: string;
  count: number;
  density: number;
  reference: string;
  status: "info" | "ok" | "high";
  note: string;
}

export interface AiToneStructure {
  key: string;
  label: string;
  value: number | null;
  reference: string;
  status: "unknown" | "low" | "high" | "ok";
  note: string;
}

export interface AiToneAnalysis {
  meta: {
    chars: number;
    hanzi: number;
    paragraphs: number;
    headings: number;
    sentences: number;
  };
  summary: {
    actionable: number;
    structure_flags: number;
    keep: number;
  };
  groups: AiToneGroup[];
  fingerprints: AiToneFingerprint[];
  structure: AiToneStructure[];
  keep: AiToneGroup[];
  limits: {
    max_chars: number;
    min_hanzi: number;
  };
}

export interface AiToneSemanticIssue {
  type: "rename" | "cohesion" | "colon" | "iso3";
  label: string;
  excerpt: string;
  reason: string;
}

export interface AiToneChange {
  before: string;
  after: string;
  rule: string;
}

export interface AiToneRewriteResult {
  text: string;
  semantic_issues: AiToneSemanticIssue[];
  changes: AiToneChange[];
  before: AiToneAnalysis;
  after: AiToneAnalysis;
  disclaimer: string;
}
