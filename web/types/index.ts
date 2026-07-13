/**
 * 全局类型定义（跨模块共享）。
 * 与后端 schemas 对应（见 server/app/schemas/）。
 */

/** 题目（对应 server/app/schemas/questionnaire.py） */
export interface Question {
  /** 后端主键（PATCH 后返回；体检列表场景可不传） */
  id?: string;
  index: number;
  text: string;
  questionType: "likert5" | "likert7" | "demographic" | "other";
  dimension: string;
  isReverse: boolean;
  /** 维度归属置信度：明确 vs 存疑（宪法第 13 条） */
  confidence: "high" | "low";
}

/** 题目结构 + 维度归属表（R1~R3 体检输出） */
export interface QuestionnaireStructure {
  questions: Question[];
  dimensions: string[];
  scaleType: string;
}

/** 假设主效应路径（A 体验：用户一句话假设经 LLM 解析） */
export interface HypothesisPath {
  predictor: string; // 自变量维度
  outcome: string; // 因变量维度
  direction: "positive" | "negative";
  strength: "weak" | "medium" | "strong";
}

/** 数据生成参数（C 底层） */
export interface SimulationConfig {
  sampleSize: number;
  hypothesisText: string;
  paths: HypothesisPath[];
}

/** 相关矩阵单元（透明展示：用户假设 vs 系统补全） */
export interface MatrixCell {
  row: string;
  col: string;
  value: number; // -1 ~ 1
  source: "user" | "system";
}

/** 相关矩阵 */
export interface CorrelationMatrix {
  dimensions: string[];
  cells: MatrixCell[][];
}

/** 模拟数据响应（GET /simulation/{id}）：矩阵 + 已保存假设 */
export interface SimulationData {
  matrix: CorrelationMatrix;
  hypothesisText?: string | null;
  paths?: HypothesisPath[];
}

/** 统计结果 - 信效度 */
export interface ReliabilityResult {
  dimension: string;
  alpha: number;
  kmo: number;
  bartlettPValue: number;
  passed: boolean;
  /** 分档等级（后端 statistics_constants 计算，可选兼容旧数据） */
  alphaGrade?: string;
  alphaWording?: string;
  kmoGrade?: string;
  kmoWording?: string;
  bartlettGrade?: string;
  bartlettWording?: string;
}

/** 诊断结论（R4 输出） */
export interface Diagnosis {
  passed: boolean;
  /** 不达标项；规则级翻车点 value/threshold 为 0（不绑定具体数值） */
  issues: Array<{
    dimension: string;
    metric: string;
    value: number;
    threshold: number;
    reason: string;
    suggestion: string;
  }>;
}

/** 差异检验结果（不落库，按假设路径实时计算，对应架构文档 9.6 决策树） */
export interface DiffTestResult {
  predictor: string;
  outcome: string;
  method?: string | null;
  methodName?: string | null;
  ivType?: string;
  dvType?: string;
  groupCount?: number | null;
  statistic?: number | null;
  pValue?: number | null;
  effectSize?: number | null;
  effectSizeName?: string;
  effectSizeGrade?: string;
  significant?: boolean;
  interpretation?: string;
  error?: string;
}

/** 项目 */
export interface Project {
  id: string;
  name: string;
  status: "draft" | "inspected" | "simulated" | "analyzed";
  createdAt: string;
  updatedAt: string;
  /** 关联的题目结构（体检后填充） */
  structure?: QuestionnaireStructure;
}

/** 报告 */
export interface Report {
  id: string;
  projectId: string;
  /** 总量表平均 α（后端 overall_alpha，Decimal→number） */
  overallAlpha?: number;
  /** 达标维度数（后端 passed_count） */
  passedCount?: number;
  /** 维度总数（后端 total_count） */
  totalCount?: number;
  reliability: ReliabilityResult[];
  diagnosis: Diagnosis;
  /** 差异检验结果（不落库，实时计算；无假设路径时为 null） */
  diffTests?: DiffTestResult[] | null;
  /** 样本量（不落库，从 SimulationConfig 实时查询注入） */
  sampleSize?: number;
  createdAt: string;
}
