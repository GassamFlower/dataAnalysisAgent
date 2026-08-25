# V2 第一轮任务清单（可直接开工）

> 关联：`docs/z-v2立项方案.md`（立项）+ `docs/FRONTEND_ARCHITECTURE.md`（设计真源）
> 版本：v1.0 · 2026-08-25
> 原则：每一阶段为可独立验收的里程碑；每个任务必带可检查的验收标准 + Git 提交点；一次性只推进一个阶段。

---

## 范围（本轮要做的）

| 来源 | 内容 | 优先级 |
|------|------|--------|
| 四方向 · 预演深化 | 命中率 + 答辩模拟 | P0 |
| 四方向 · 人工服务闭环 | 店铺接单 / 报告救急转人工 / 财务闭环 | P0 |
| 售后基建 | 留言表单入库 admin + 模板库 + 客服微信占位 + 双入口 | P0 |
| 认知层 · 论文模板（写） | 报告内一键生成"对齐实际结果的 APA 段落"（共用合规红线） | P0 |
| 四方向 · 学科量表库 | 管理/教育/心理各 3~5 条，与预演联动 | P1 |
| 四方向 · 前端优化 | 报告图表交互 + 落地页可交互预演 demo + 色板修复 | P1 |
| 认知层 · 数据分析小知识（学） | 诊断解释层（术语就地解释）+ 预演微课 + /learn 语义搜索 | P2 |
| 三主题一致性 + 移动端核心页适配 | dark/sepia/light 图表对比度；核心页移动适配 | P2 |
| 上线前验收 | 产出 `docs/s-上线前验收报告.md` | P0 |

## 明确不做（防范围蔓延）

- 智能体资讯/论文新闻搜索（已决议：完全不做，泛版与收敛版皆不做）。
- 广谱统计方法聚合（500+）、AI 对话式问卷生成、样本投放。
- 全量论文写作器（论文模块只做"结果案例段落"生成，不做综述/排版/降重）。
- 任何重构现有技术栈、推翻当前主题体系的改动。

---

## 强制规则（所有任务必须遵守）

1. **合规红线**：论文模板辅助 / 答辩模拟的产出只允许"统计结果规范化描述"，禁止生成研究结论；策略与现有 `simulation-disclaimer` / `compliance` 一致。
2. **设计单一真源**：样式一律走 `web/styles/tokens.css` + `docs/FRONTEND_ARCHITECTURE.md`，禁止新增散装硬编码色（本轮已把 learn 难度/标签改为语义 token 作为例）。
3. **数据库 3NF**：新表（留言、量表）必须按 1NF/2NF/3NF 设计并先评审；反规范化需注明同步策略。
4. **测试六步法**：业务模块完成后按 testing-strategy 走"手动闭环 + 三类用例 + 回归自动化"，验收必须附证据（测试/构建日志），不说"已完成"。
5. **上线前验收**：预留 `docs/s-上线前验收报告.md` 与严重项修复/风险登记时间，不得压缩到上线当天。
6. **Git 提交点**：每个任务完成、验收通过即提交；本地 `curl` 用 `curl.exe` / `Invoke-RestMethod`（Windows PowerShell 别名陷阱）。

---

## Stage 1 · 预演深化（P0-1）

| 任务 | 做什么 | 涉及文件/模块 | 依赖 | 验收标准 |
|------|--------|---------------|------|----------|
| 1.1 命中率指标 | 预演结果按"假设→效应量→样本量"计算目标统计量命中概率，页面展示命中率并标出达不到的假设 | `server/app/services/generator.py`, `server/app/services/stats.py`, `models/simulation_config.py`; web `app/(app)/projects/[id]/simulate/page.tsx`, `components/simulation/*` | 现有预演流水线 | 预演页能看到命中率 + 置信度标记；新增命中率单测（tests 目录）通过 |
| 1.2 模拟答辩摘要 | 预演结果一键生成"答辩模拟"摘要（仅述统计范式，输出合规红线内容） | `server/app/services/report_polisher.py`（新增答辩方法）、`api/v1/report.py`；web `components/report/polish-button.tsx`、simulate 导出 | 1.1 | 摘要可导出；内容自检无语义结论断言；`test_polish` 扩展通过 |
| 1.3 预演→报告传导 | 报告中标注"数据来自预演"（沿用 `simulation-report-banner`），把预演命中率/失效假设带入报告 | `server/app/services/reporter.py`；web `components/compliance/simulation-report-banner.tsx` | 1.1, 1.2 | 报告正确标注预演来源与命中情况；CI 构建通过 |

## Stage 2 · 人工服务闭环 + 售后基建（P0-2, P0-3）

| 任务 | 做什么 | 涉及文件/模块 | 依赖 | 验收标准 |
|------|--------|---------------|------|----------|
| 2.1 留言数据模型+接口 | 留言表（5 类 tag + 关联 project_id + 数据源），增删查/标记处理接口，入库 admin 可留痕、衔接审计 | `server/app/models/message.py`（新）+ migration, `api/v1/message.py`（新）, `schemas/message.py`（新） | — | 建/查/处理 3 接口通过 `tests/test_message.py`；五类 tag + project_id + 数据源落库 |
| 2.2 留言模板库表单 | 内嵌留言表单，5 类模板填空式，自动带项目ID/数据源 | `web/components/contact/contact-form.tsx`（新）, `hooks/use-contact.ts`（新） | 2.1 | 定价页/报告救急区/页脚三入口可提交且数据可查 |
| 2.3 客服微信占位+双入口 | 后端配置 `CUSTOMER_SERVICE_WECHAT_ID` 占位；前端一键加微信入口（占位态弹"敬请期待"），改一处配置即切真实号 | `server/app/core/config.py` + `.env(.example)`; `web/components/contact/wechat-entry.tsx`（新）、常量引用 | 2.1 | 占位可点有反馈；只改 env 值页面即切换，无需改页面代码 |
| 2.4 admin 留言管理页 | 后台按 5 类 tag 筛选 + 标记处理 + 一键复制微信/联系方式 | `web/app/(app)/admin/messages/page.tsx`（新）、`lib/api/admin.ts` | 2.1, 2.2 | admin 可检索/处理留言；手动闭环通过 |
| 2.5 服务闭环+财务（暂缓） | 报告/救急区"人工分析服务"入口 → 付费下单入 order → 店铺接单 | `server/app/services/payment_service.py`, `api/v1/payment.py`, `models/order.py`; web 报告页 + pricing | 2.2 | ⏸ 已暂缓：人工服务/财务对接未完成（2026-08-25），待对接落实后再推进 |

## Stage 3 · 论文模板辅助（写）（P0-4）

| 任务 | 做什么 | 涉及文件/模块 | 依赖 | 验收标准 |
|------|--------|---------------|------|----------|
| 3.1 论文段落生成 | 报告"方法/结果/讨论"单选，一键生成对齐实际结果（Cronbach α / P值 / 预演命中率）的 APA 段落，仅结果规范化、不代写结论 | `server/app/services/report_polisher.py`, `api/v1/report.py`; web `components/report/polish-button.tsx` | 1.2 | 三段落可生成且数字取自本项目；红线自检无结论断言；`test_polish` 通过 |

## Stage 4 · 学科量表库（P1）

| 任务 | 做什么 | 涉及文件/模块 | 依赖 | 验收标准 |
|------|--------|---------------|------|----------|
| 4.1 量表数据结构+seed | 量表表（名称/维度/条目/计分/来源/信效度引用），公开量表 seed 管理/教育/心理各 3~5 条 | `server/app/models/research_scale.py`（新）+ migration, `services/scale_service.py`（新）、`scripts/seed_scales.py`（新） | — | 各专业 3~5 条可检索；来源/信效度标注可见（3NF 评审通过） |
| 4.2 量表→预演联动 | 流程：选量表→一键建问卷项目→可直接走预演 | `server/app/services/project_service.py`；web 建项目流程 | 4.1 | 选量表一键建项目并可走预演；端到端通过 |
| 4.3 量表库页面 | 公开列表/搜索/来源展示 | `web/app/(marketing)/scales/page.tsx`（新） | 4.1, 4.2 | 页面可检索、可跳转建项目；三主题下样式一致（走 tokens） |

## Stage 5 · 前端优化（P1）

| 任务 | 做什么 | 涉及文件/模块 | 依赖 | 验收标准 |
|------|--------|---------------|------|----------|
| 5.1 报告图表交互 | 图表悬停数值/图例筛选，三主题下对比度达标 | `web/components/report/*`（correlation-heatmap / reliability-chart / effect-size-chart / diff-test-table） | — | 三主题悬停可见、数值可读；无横向溢出 |
| 5.2 色板修复 | 修复 chart-1 砖红与 chart-5 橄榄色相近（色盲兼容） | `web/styles/tokens.css` | 5.1 | 色盲模拟可区分；light/sepia/dark 各过一遍 |
| 5.3 落地页可交互预演 demo | 拖动效应量→命中率实时变化（纯前端），对比竞品"拖拽即得" | `web/app/(marketing)/page.tsx`, `components/marketing/*` | 5.2 | demo 可拖、命中率实时更新、移动端可用 |

## Stage 6 · 数据分析小知识（学）（P2）

| 任务 | 做什么 | 涉及文件/模块 | 依赖 | 验收标准 |
|------|--------|---------------|------|----------|
| 6.1 诊断解释层 | 报告内信度/效度/相关/差异检验/预演命中率术语就地可 hover/点选释义（"为什么/怎么办"） | `web/components/tutorial/MetricTooltip.tsx`, `components/report/*` | 5.1 | 报告中上述术语可交互释义；三主题无样式回归 |
| 6.2 预演微课+新手路径 | 新增"发问卷前为何先预演"微课（内容 + 挂载），前台可达并可进入预演 | `server/scripts/tutorial_content/` 新增、`scripts/seed_tutorials.py`, `web/app/(marketing)/learn/*` | — | 微课上线、前台可达；learn 首页 banner 已就位（本轮已先行完成筛选收敛） |
| 6.3 /learn 语义搜索 | 关键词→教程/术语检索 | `server/app/api/v1/tutorial.py`（检索）、`web/app/(marketing)/learn/page.tsx` | 6.2 | 关键词命中教程/术语；检索单测通过 |

## Stage 7 · 三主题一致性 + 移动端（P2）

| 任务 | 做什么 | 涉及文件/模块 | 依赖 | 验收标准 |
|------|--------|---------------|------|----------|
| 7.1 三主题图表对比度复核 | dark/sepia/light 图表 + 密集表格复核 | `web/*`（报告/learn/admin） | 5.x | 三主题截图人工核对无对比度问题 |
| 7.2 移动端核心页适配 | 报告/预演/learn/定价在 375px 无横向溢出、功能可达 | `web/app/(app)/projects/[id]/report`、`simulate`、`learn`、`pricing` | 5.1 | 375px 截图无溢出、核心流程可走通 |

## Stage 8 · 上线前验收（P0）

| 任务 | 做什么 | 涉及文件/模块 | 依赖 | 验收标准 |
|------|--------|---------------|------|----------|
| 8.1 上线前验收 | 全链路回归 + 严重项修复/风险登记，产出验收报告 | 产出 `docs/s-上线前验收报告.md` | 全部 | 验收报告落盘；严重项清零或已登记修复计划；不得压缩到上线当天 |

---

## 下一阶段任务清单（每次只推进前三项之一）

1. **运行 Stage 1.Task 1.1**——预演命中率计算（后端公式 + 页面展示 + 单测）。
2. **并行启动 Stage 2.Task 2.1**——留言表/接口/入库 admin（纯后端，可与 1 并行）。
3. **推进 Stage 3.Task 3.1**——论文段落生成按钮（依赖 run 完成后再细化 LLM 提示词边界）。
4. （P2）Stage 6.Task 6.1 诊断解释层 —— 需报告组件稳定后接入。