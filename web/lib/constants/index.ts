/**
 * 全局常量 / 枚举。
 * 所有硬编码业务值集中于此，禁止散落在组件里。
 */

/** 项目流程步骤（对应 StepNav） */
export const PROJECT_STEPS = [
  { key: "inspect", label: "题目体检", description: "识别题型 / 维度 / 反向题" },
  { key: "simulate", label: "数据预演", description: "生成模拟数据 + 验证趋势" },
  { key: "report", label: "报告产出", description: "统计 + 诊断 + 导出" },
  { key: "export", label: "数据导出", description: "下载模拟数据集" },
] as const;

export type ProjectStepKey = (typeof PROJECT_STEPS)[number]["key"];

/**
 * 强度档位（宪法第 15 条：本科毕设生简化原则，不暴露 r 值）。
 * 后端映射：weak≈0.2 / medium≈0.4 / strong≈0.6。
 */
export const STRENGTH_OPTIONS = [
  { value: "weak", label: "弱相关" },
  { value: "medium", label: "中等相关" },
  { value: "strong", label: "强相关" },
] as const;

export type Strength = (typeof STRENGTH_OPTIONS)[number]["value"];

/**
 * 强度档位与 r 值映射（离散化补偿值，对齐后端 generator）。
 * 用于相关矩阵编辑：点击单元格时在档位间循环切换。
 */
export const STRENGTH_TO_R: Record<Strength, number> = {
  weak: 0.2,
  medium: 0.4,
  strong: 0.6,
};

/** 由 |r| 推断强度档位（边界：0.3 / 0.5） */
export function rToStrength(absR: number): Strength {
  if (absR >= 0.5) return "strong";
  if (absR >= 0.3) return "medium";
  return "weak";
}

/** 下一档强度（弱→中→强→弱 循环） */
export function nextStrength(current: Strength): Strength {
  const order: Strength[] = ["weak", "medium", "strong"];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

/** 维度归属置信度标注（宪法第 13 条：透明展示） */
export const CONFIDENCE_LABELS = {
  high: { label: "明确归属", tone: "success" as const },
  low: { label: "存疑待确认", tone: "warning" as const },
};

/** 相关方向 */
export const DIRECTION_OPTIONS = [
  { value: "positive", label: "正向影响" },
  { value: "negative", label: "负向影响" },
] as const;

export type Direction = (typeof DIRECTION_OPTIONS)[number]["value"];

/** 定价（宪法第三章 + 立项文档第七章） */
export const PRICING = {
  free: {
    name: "免费体检",
    price: 0,
    unit: "",
    features: ["题目上传解析", "维度归属推断", "题型 / 反向题识别"],
    locked: ["R4 诊断结论", "数据生成", "报告导出"],
  },
  single: {
    name: "单次报告",
    price: 9.9,
    unit: "元 / 次",
    badge: "早鸟套餐含 1 次免费重跑",
    features: ["完整数据预演", "标准统计套餐", "R4 诊断结论", "Word / Excel 导出"],
    locked: [],
  },
  subscription: {
    name: "月度订阅",
    price: 19.9,
    unit: "元 / 月",
    badge: "不限次 · 开题季重度用户",
    features: ["单次报告全部能力", "不限次预演", "优先排队", "历史报告留存"],
    locked: [],
  },
} as const;

/** 题型 */
export const QUESTION_TYPES = {
  likert5: { label: "李克特 5 级", options: 5 },
  likert7: { label: "李克特 7 级", options: 7 },
  demographic: { label: "人口学变量", options: null },
  other: { label: "其他", options: null },
} as const;

/**
 * simulated 水印文案（宪法第 7 条：水印铁律）。
 * 报告页眉 + 数据集元数据双重标注。
 */
export const SIMULATED_WATERMARK = "SIMULATED · 研究预演数据";
export const DISCLAIMER =
  "本数据由数据分析智能体生成，仅用于研究可行性预演，不可直接用于论文或正式研究。";

/** 项目状态（与后端 ProjectStatus 枚举对齐） */
export const PROJECT_STATUS = {
  draft: { label: "待体检", tone: "muted" as const },
  inspected: { label: "已体检", tone: "info" as const },
  hypothesized: { label: "已假设", tone: "info" as const },
  simulated: { label: "已预演", tone: "info" as const },
  analyzed: { label: "已出报告", tone: "success" as const },
} as const;

export type ProjectStatus = keyof typeof PROJECT_STATUS;

/**
 * 问卷示例模板（宪法第 15 条：本科毕设生简化原则）。
 * 降低使用门槛，点击即填充项目名称 + 题目文本。
 * 每行一道题，覆盖多个维度便于体检 + 预演演示。
 */
export const QUESTIONNAISE_TEMPLATES = [
  {
    name: "大学生工作满意度调查",
    label: "工作满意度",
    description: "8 题 · 4 维度",
    rawText: `我对目前的工作内容感到满意
我与同事之间的关系融洽
我对工作环境感到舒适
我对公司的薪酬福利感到满意
我对自己的职业发展前景充满信心
工作压力有时让我感到疲惫
我认同组织的价值观和企业文化
工作与生活能够保持良好的平衡`,
  },
  {
    name: "学习动机与自我效能感研究",
    label: "学习动机",
    description: "7 题 · 3 维度",
    rawText: `我对学习新知识充满热情
我能够集中注意力完成学习任务
我相信自己能够掌握所学内容
我学习是为了获得好成绩
我学习是为了未来的职业发展
我对所学专业感兴趣
我能够合理安排学习时间`,
  },
] as const;
