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

/** 题目结构 + 维度归属表（体检输出） */
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

/** 预演命中率 - 单条假设路径（统计功效分析，F-SIM-xxx） */
export interface HypothesisHitRate {
  predictor: string;
  outcome: string;
  direction: "positive" | "negative";
  strength: "weak" | "medium" | "strong";
  effectSizeR: number;
  sampleSize: number;
  hitRate: number;
  target: number;
  passed: boolean;
}

/** 预演命中率汇总 */
export interface HitRateSummary {
  overall: number;
  passedCount: number;
  totalCount: number;
  paths: HypothesisHitRate[];
}

/** 答辩模拟 - 单条路径的答辩问答（仅统计范式，不代写结论） */
export interface DefenseQAItem extends HypothesisHitRate {
  question: string;
  answer: string;
}

/** 答辩模拟摘要（预演 · 逐路径答辩问答） */
export interface DefenseSummary {
  projectId: string;
  sampleSize: number;
  overall: number;
  passedCount: number;
  totalCount: number;
  text: string;
  disclaimer: string;
  items: DefenseQAItem[];
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

/** 模拟数据响应（GET /simulation/{id}）：矩阵 + 已保存假设 + 复算命中率 */
export interface SimulationData {
  matrix: CorrelationMatrix;
  hypothesisText?: string | null;
  paths?: HypothesisPath[];
  /** 已生成过预演时返回复算的命中率（与 generate 同源） */
  hitRate?: HitRateSummary | null;
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

/** 诊断结论（智能诊断输出） */
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
    /** 一句话结论：告诉你怎么办（确定性模板，F-RPT-008 增强） */
    oneLiner?: string;
  }>;
}

/** 样本代表性 - 单个人口学变量分布（F-RPT-007） */
export interface SampleRepDistribution {
  index: number;
  text: string;
  label: string;
  counts: Record<string, number>;
  total: number;
  topCategory: string;
  topShare: number;
}

/** 样本代表性 - 单项检查 */
export interface SampleRepItem {
  key: string;
  title: string;
  status: "pass" | "warn" | "fail";
  message: string;
  suggestion: string;
}

/** 样本代表性体检报告（F-RPT-007） */
export interface SampleRepresentativeness {
  supported: boolean;
  message: string;
  sampleSize: number;
  hasDemographic: boolean;
  overallScore: number;
  grade: string;
  summary: string;
  distributions: SampleRepDistribution[];
  items: SampleRepItem[];
  aiConclusion: string;
}

/** 样本量规划请求（F-RPT-008） */
export interface SampleSizePlannerRequest {
  analysisType:
    | "correlation"
    | "t_test"
    | "paired_t_test"
    | "anova"
    | "regression"
    | "stratified";
  effectSize?: number | null; // null → 自动：预演矩阵 / 默认中等效应
  alpha?: number;
  power?: number;
  groups?: number | null; // ANOVA 组数（≥2）
  strata?: number | null; // 分层抽样层数（≥1）
  plannedN?: number | null; // 计划回收样本量（可选，用于判定）
}

/** 样本量规划结果（F-RPT-008） */
export interface SampleSizePlannerResult {
  analysisType: string;
  analysisLabel: string;
  effectSize: number;
  effectLabel: string;
  effectSource: "user" | "simulation" | "default";
  alpha: number;
  power: number;
  requiredN: number; // 公式所需（t_test 为总数）
  perGroupN: number | null; // t_test 每组样本量
  representativeMin: number; // 代表性建议下限
  recommendedN: number; // 建议回收目标
  plannedN: number | null;
  verdict: "sufficient" | "marginal" | "insufficient" | "unknown";
  verdictLabel: string;
  shortfall: number;
  guidance: string[];
  oneLiner: string;
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

/** 项目概览：最新数据集摘要 */
export interface ProjectDatasetOverview {
  source: "real" | "simulation" | null;
  sampleSize: number | null;
  importedAt: string | null;
}

/** 项目概览：最新报告摘要 */
export interface ProjectReportOverview {
  hasReport: boolean;
  overallAlpha: number | null;
  passedCount: number | null;
  totalCount: number | null;
  generatedAt: string | null;
}

/** 项目概览聚合数据 */
export interface ProjectOverview {
  questionCount: number;
  dimensionCount: number;
  reverseCount: number;
  dataset: ProjectDatasetOverview;
  report: ProjectReportOverview;
}

/** 项目 */
export interface Project {
  id: string;
  name: string;
  /** 数据模式：真实数据项目 vs 模拟预演项目 */
  mode: "real" | "simulation";
  status: "draft" | "inspected" | "hypothesized" | "simulated" | "analyzed";
  createdAt: string;
  updatedAt: string;
  /** 关联的题目结构（体检后填充） */
  structure?: QuestionnaireStructure;
  /** 项目概览聚合数据（后端 GET /projects/{id} 返回） */
  overview?: ProjectOverview;
  /** 项目列表携带的统计字段 */
  questionCount?: number;
  dimensionCount?: number;
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

/** 学科量表：列表项（对应 server/app/schemas/scale.py ScaleListItem） */
export interface ScaleListItem {
  id: string;
  slug: string;
  name: string;
  discipline: "management" | "education" | "psychology";
  description?: string;
  source?: string;
  reliabilityRef?: string;
  validityRef?: string;
}

/** 学科量表：列表响应（对应 ScaleListResponse） */
export interface ScaleListResponse {
  items: ScaleListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 学科：中文标签 */
export const SCALE_DISCIPLINES = [
  { value: "management", label: "管理学" },
  { value: "education", label: "教育学" },
  { value: "psychology", label: "心理学" },
] as const;
