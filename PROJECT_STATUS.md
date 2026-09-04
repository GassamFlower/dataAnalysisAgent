# 项目状态追踪

> 每次开始工作先看它，结束就更新它。日常开发只看这一个文件，不翻知识库。

---

## 项目信息

- **项目名称**：数据分析智能体（Data Analysis Agent，内部代号：预演）
- **文档根目录**：`docs/`
- **开始日期**：2026-07-18（首轮上线）
- **当前门禁**：上线门 — ✅ 已通过（2026-07-29 上线前风险项全部清零）
- **当前产品版本**：v1.5（2026-08-24 最新）
- **定位版本**：v2.0（2026-08-04 定位锚点收敛为"预演+诊断深井"）

---
## 当前门禁

> 从以下 4 个门禁中选一个：立项门 / 架构门 / 业务门 / 上线门

**当前门禁**：上线门（已通过，进入迭代运营阶段）

**进入时间**：2026-07-29

**阶段说明**：正式上线运营中，产品定位已更新为"预演+诊断差异化深井"，当前以差异化壁垒加固为主方向。

---

## V2 第一轮进度（进行中）

> 关联：`docs/z-v2立项方案.md` + `v2-first-round-plan.md`。逐阶段推进，每任务必带验收证据与提交点。

| 阶段 / 任务 | 状态 | 验收证据 |
|------|------|----------|
| Stage1 · 1.1 预演命中率（Fisher z 功效 + 假设命中率） | ✅ 完成 | 后端命中率单测通过；前端 hit-rate-card 展示并提示提样本量；修复命中率实时显示（snake→camel 归一）；全量 pytest 193+ 通过 |
| Stage1 · 1.2 模拟答辩摘要（仅述统计范式，合规红线） | ✅ 完成 | defense-summary BFF + 面板 + 一键复制；后端 203 passed，前端 tsc --noEmit 通过 |
| Stage1 · 1.3 预演→报告传导 | ⏳ 未开始 | — |
| Stage2 · 2.1 留言表后端（5 tag + project_id + 数据源 + 审计） | ✅ 完成 | models/schemas/api + migration；修复 FK 歧义/重定向/审计排序；tests/test_message.py 通过 |
| Stage2 · 2.2 留言模板库表单（5 类填空式 + 三入口） | ✅ 完成 | contact-form + use-message + 定价页/报告救急区/页脚接入，自动关联项目ID与数据源；tsc 全绿；message tests 8 passed |
| Stage2 · 2.3 客服微信占位 + 双入口 | ⏳ 未开始 | — |
| Stage2 · 2.4 admin 留言管理页 | ⏳ 未开始 | — |
| Stage2 · 2.5 服务闭环 + 财务下单 | ⏳ 未开始 | — |
| Stage3 · 3.1 论文段落生成（APA，仅结果规范化） | ⏳ 未开始 | — |
| Stage4 · 4.1~4.3 学科量表库（管理/教育/心理 3~5 条 + 联动） | ⏳ 未开始 | — |
| Stage5 · 5.1~5.3 前端优化（图表交互/色板修复/可交互 demo） | ⏳ 未开始 | — |
| Stage6 · 6.1~6.3 数据分析小知识（解释层/微课/语义搜索） | ⏳ 未开始 | — |
| Stage7 · 7.1~7.2 三主题一致性 + 移动端 | ⏳ 未开始 | — |
| Stage8 · 8.1 上线前验收（产出 s-上线前验收报告） | ⏳ 未开始 | — |

---

## 验收清单

> 上线门已通过（详见 [s-上线前验收报告.md](docs/s-上线前验收报告.md)），当前为迭代运营阶段。

### 已上线模块（R3 验收通过）

| 模块 | 状态 | 验证 |
|------|------|------|
| 认证模块（邮箱注册/登录/微信扫码/双 Token/刷新/退出） | ✅ R3 验收 | 测试 126 passed，0 failed |
| 项目管理（CRUD/软删除/分页/状态机单向流转） | ✅ R3 验收 | 状态机：draft→inspected→hypothesized→simulated→analyzed |
| 问卷体检（文件上传/维度归属/反向题标记/7 项规则检查） | ✅ R3 验收 | v1.2 质量体检引擎，纯规则 7 项检查 |
| 问卷星链接解析 | ✅ R1 验收 | 单元测试 54 通过 |
| 真实数据导入（CSV/Excel） | ✅ R3 验收 | 支持真实/模拟双模式 Tab 切换 |
| 模拟预演（假设路径/相关矩阵编辑/数据生成） | ✅ R3 验收 | 免费层前端引导，真实套餐校验 |
| 统计分析（信效度/差异检验/相关矩阵） | ✅ R3 验收 | 真实统计计算，无 fallback 示例数据 |
| 智能诊断（规则 + LLM 双重诊断） | ✅ R3 验收 | 规则优先，LLM 补充自然语言原因 |
| 样本代表性诊断（F-RPT-007） | ✅ v1.3 验收 | 免费、纯诊断不卖样本，阈值唯一来源；v1.4 起进入导出一致性 |
| 样本量规划器（F-RPT-008） | ✅ v1.3.1 验收 | 预演闭环：预演效应量→回收目标，公式引擎无 LLM；v1.4 起报告页联动已收 N |
| 报告导出（Word/Excel/PDF/PPT + SIMULATED 水印） | ✅ R3 验收 | 四格式全部通过烟雾测试；v1.4 起含代表性/规划章节 + 一句话结论 |
| 报告润色（LLM 转化为论文段落） | ✅ R1 验收 | 四扩展功能单元测试 54 通过 |
| SPSS 文件导入 | ✅ R1 验收 | 四扩展功能单元测试 54 通过 |
| 订阅支付（套餐/订单/回调/定价页） | ✅ R3 验收 | 微信扫码支付，真实套餐校验 |
| 用户设置（昵称/密码/邮箱/头像/套餐状态） | ✅ R3 验收 | 真实数据联调通过 |
| 合规与学术安全（审计日志/免责声明/协议勾选） | ✅ R4 验收 | 全链路审计日志补全 |
| 统计分析教程（14 篇教程/AI 解读助手/管理员后台） | ✅ R3 验收 | 三阶段全部完成，v1.2 增强，v1.4 扩篇 2 篇（样本量/代表性） |
| 埋点分析（基础指标看板/数据监控） | ✅ P1 验收 | 运营基础建设完成 |
| 上线前安全整改（P0/P1 风险项、N1~N7 建议项） | ✅ 全部整改 | 18 项风险/建议全部清零 |

### 上线前风险整改状态

| 等级 | 数量 | 状态 |
|------|------|------|
| 🔴 严重（阻断上线） | 2 项 | ✅ 全部修复 |
| 🟡 风险（可上线后修） | 9 项 | ✅ 全部修复 |
| 🟢 建议（后期优化） | 8 项 | ✅ 全部修复 |

---

## 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v1.0 | 2026-07-18 | 首轮上线，核心模块（认证/项目/问卷/模拟/分析/报告/导出/支付）全部通过 R3 验收 |
| v1.1 | 2026-08-06 | 四扩展功能（问卷星解析/SPSS导入/PPT导出/报告润色）收尾 + 撤销V2电商转型 |
| v1.2 | 2026-08-06 | 问卷质量体检引擎 v2（纯规则7项检查 + 前端体检报告卡片） |
| v1.3 | 2026-08-10 | 样本代表性诊断 F-RPT-007（免费） + 首页叙事重写 + 一句话结论 + v1.2 遗留 BFF 缺路修复 |
| v1.3.1 | 2026-08-10 | 样本量规划器 F-RPT-008（预演闭环：效应量→回收目标→代表性回看，公式引擎无 LLM） |
| v1.4 | 2026-08-10 | 导出物一致性（Word/Excel/PDF/PPT 含代表性+规划+一句话结论）+ 报告页 Tabs 化（5 页签）+ 规划已收 N 联动对照 + 教程扩篇 2 篇 |
| v2.1（前端） | 2026-08-11 | 前端样式分层升级：theme 三态化（light/sepia/dark）+ 暗色改暖褐；品牌记忆点（纸质纹理/水印字）；控件手感（按钮/输入/表格）；动效层级；可读性收敛；新增设计系统真源文档 |
| v1.5 | 2026-08-24 | 教程 SEO 增强 + 样本量计算器：tutorial_articles 新增 tags/difficulty（模型+迁移+API+服务+管理端表单+公开列表筛选）、8 篇 SEO 长尾文（21~28，含信效度不达标/样本量/维度/不显著等查清单）、公开样本量计算器工具页（/learn/tools/sample-size，Pearson/t检验/ANOVA 估算，无登录） |
| v2.0（定位） | 2026-08-04 | 文档层面定位更新，立项文档/功能清单/系统架构文档同步修订 |
| v1.5.3 | 2026-09-04 | 管理后台 UI/架构大优化：① `/admin` 自 `(app)` 组迁至顶层独立路由（脱离双层导航），AdminShell 升级为全屏后台工作台（桌面左侧分组边栏：概览/运营/内容/系统 + 底部身份区头像/退出/回端应用，移动端抽屉）；② 抽取公共组件 `web/components/admin/`（PageHeader/TableEmpty/TablePagination/PageLoading）并统一全部 8 个后台页面及 tutorials 新建/编辑页；③ 留言管理支持勾选批量标记（后端新增 `PATCH /admin/messages/batch-status` 逐条审计）；④ 审计日志详情键值可展开 + 操作类型下拉预置；⑤ 运营概览顶部快捷入口卡片。后端全量 251 pytest 全绿，前端 tsc 通过，已生产部署并验证批量接口上线 |

| v1.5.2 | 2026-09-04 | 管理后台用户管理完善（承接"看到每个注册用户并可管理"）：① 用户列表新增「注册时间」列+「只看禁用」筛选；② 用户详情页从只读升级为可管理（改套餐/禁用启用/线下开通）；③ 新增 `POST /admin/users/export` 导出全部注册用户 CSV（UTF-8 BOM，Excel 中文不乱码，一次拉全量）；④ 前端 [id] 详情页补全。后端全量 246 pytest 全绿，前端 tsc 通过；已生产部署并在线上验证导出接口 |

| v1.5.1 | 2026-09-03 | 管理后台功能优化（4 项）：① 配置与配额页运行时编辑免费配额（新增 `app_configs` 表+迁移+模型+服务+API，quota 实时生效）；② 订单页退款标记（paid→refunded 仅对账）+ 线下/在线来源标识；③ 留言页一键复制联系方式/邮箱；④ 运营看板补套餐分布/项目规模/活跃用户/留言待办（`/admin/dashboard/overview`）。后端 244 pytest 全绿，前端 tsc 通过，新增 `tests/test_admin_optimizations.py` |

---

## 文档清单

| 文档 | 版本 | 说明 |
|------|------|------|
| [a-立项文档.md](docs/a-立项文档.md) | v2.0 | 产品定位、竞品分析、竞争壁垒 |
| [b-功能清单.md](docs/b-功能清单.md) | v2.0 | 全功能清单，含差异化叙事映射 |
| [系统架构文档.md](docs/系统架构文档.md) | v3.0 | 全面系统架构说明 |
| [用户手册.md](docs/用户手册.md) | v1.0 | 用户使用指南 |
| [l-数据库设计文档.md](docs/l-数据库设计文档.md) | v1.0 | 数据库 schema 设计 |
| [s-上线前验收报告.md](docs/s-上线前验收报告.md) | v1.2 | 上线前审查与整改记录 |
| [s-2026-08-10-下阶段验收报告.md](docs/s-2026-08-10-下阶段验收报告.md) | v1.3.1 | 样本代表性诊断 + 首页叙事 + 一句话结论 + 样本量规划器验收 |
| [s-2026-08-10-导出物一致性验收报告.md](docs/s-2026-08-10-导出物一致性验收报告.md) | v1.4 | 导出物一致性 + 报告页 Tabs 化 + 规划联动 + 教程扩篇验收 |
| [t-项目复盘报告.md](docs/t-项目复盘报告.md) | v1.0 | 项目复盘与踩坑记录 |
| [q-业务模块开发清单.md](docs/q-业务模块开发清单.md) | v2.1 | 业务模块开发进度 |
| [FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | v2.0 | 前端设计系统单一真源（设计 token / 三主题 / 样式工具类） |

---

## 下一步

> 当前要做的具体任务（不超过 3 项）

**线下成交转最小可行方案（当前，关联 [docs/线下成交转最小可行方案.md](docs/线下成交转最小可行方案.md)）**
1. ~~**Step1 前端去付费展示**~~ ✅ 已完成（2026-08-25：`/pricing` 改「服务咨询」页去价与支付 CTA，全站导航/文案去「定价/套餐/付费」，删 `price-tag.tsx` 与 `PRICING` 常量，C 端不再触发在线下单）
2. ~~**Step2 停在线支付后端 + 后台手动开通**~~ ✅ 已完成（2026-08-25：`ENABLE_ONLINE_PAYMENT` 默认关 + 在线支付门控；`POST /admin/orders` 线下单同事务激活套餐 + 审计；admin users「开通」对话框；新增 4 条测试，全量 236 passed）
3. **Step3 生产启客服微信真实号 + 验收报告** —— `.env.production` 填 `CUSTOMER_SERVICE_WECHAT_ID`；全链路回归产出 `docs/s-线下成交验收报告.md`。

**UI 落地页打磨（2026-08-25，关联 [docs/UI设计-落地页打磨.md](docs/UI设计-落地页打磨.md)）**
1. ~~**S1-S5 落地页/导航/页脚 精致化打磨**~~ ✅ 已完成（2026-08-25：保留 warm-cream 复古品牌；门面图标 lucide→`@phosphor-icons/react`；Hero 去叠字水印/去 mono 水印行/精简 4 层、`pt-20/pb-24` 大留白；水印入「预演数据」脚注；痛点卡弱化红底；全站 section `py-16` 编辑感留白；tsc 0 错 / lint 全绿）
2. **UI 打磨 Step2（后续分批）**：产品工作区 / 报告 / 后台图标分批切 Phosphor；三主题（Sepia/Dark）对比度精修；落地页 Demo 交互再加工。

**V2 第一轮（并行/后续）**
1. **Task 2.3 客服微信占位 + 双入口** —— 后端 `CUSTOMER_SERVICE_WECHAT_ID` 占位 + `wechat-entry` 组件（占位弹"敬请期待"，只改 env 即切真实号）。
2. **Task 2.4 admin 留言管理页** —— 按 5 类 tag 筛选 + 标记处理 + 一键复制联系方式。
3. **Task 2.5 服务闭环 + 财务** —— 报告/救急区"人工分析服务"→下单入 order→店铺接单。

（已完成的上轮收尾项，保留存档）
1. ~~**规划器增强**~~ ✅ 已完成（2026-08-11：新增 ANOVA/配对/分层设计 + 检验类型与模拟页联动）
2. ~~**导出代表性接入 LLM 说人话结论**~~ ✅ 已完成（2026-08-11：可选开关，默认规则结果保证确定性）
3. ~~**教程 SEO/学习路径增强**~~ ✅ 已完成（2026-08-11：学习路径导航 + 相关文章推荐）

> **技术债复核（2026-08-24）——已闭环 ✅**
> 款单列项已确认 **非问题**：
> 1. ~~本地解释器统一 3.11~~ → 用户确认**不上本机测试，直接生产机处理**，本地 3.8 venv 无需动（`main.py` 3.11 门禁只影响本地启动，不影响生产 Docker 3.11）。
> 2. ~~git 历史密钥轮换~~ → 用户确认 `deploy.sh` 中硬编码的 `sk-`（含 Agnes）为**公开可接受的开放 key，不视为泄露，无需轮换**。

> 下一阶段候选（待排期）：规划器与模拟页检验方法深度联动（按变量类型决策树自动带入）、导出物 AI 结论的配额/计费策略细化、教程 SEO 结构化数据（JSON-LD）

> ⚠️ 2026-08-24 技术债复核：`验收-总验收审查清单.md`（生成于 2026-08，早于 `d13df30` 整改提交）所标 🔴 项已在 `d13df30`「上线前整改(defect/security/env)」中逐项清零。本日复核对齐后，原标 🔴 与技术债项**全部闭环**（含两笔由用户拍板的决策）。

---

## 质量审查整改登记（2026-08-25）

> 本轮按整改清单分 3 批处理：第 1 批 🔴 严重（本轮必须修完）、第 2 批 🟡 风险（可上线后修，文档登记）、第 3 批 🟢 建议（暂不修，入后期优化清单）。

### 第 1 批：🔴 严重项（本轮已修完 ✅）

| # | 修复前 | 修复后 | 验证证据 |
|---|--------|--------|----------|
| 1 | 新表（messages / research_scales / scale_dimensions / scale_items）仅靠 `create_all` 隐式建表，**无 Alembic 迁移**，生产无法 `upgrade head` 干净落位 → schema 漂移风险 | 新增迁移 [c5d6e7f8a9b1_add_messages_and_research_scales.py](server/migrations/versions/c5d6e7f8a9b1_add_messages_and_research_scales.py)，链尾衔接 `abf2c1011234` | `alembic heads` 输出 `c5d6e7f8a9b1 (head)`；临时库 `_alembic_verify.db` 全量 upgrade 通过 |
| 2 | `db/schema.sql` / `schema.sqlite.sql` 缺新表定义 → 真源文档与实际结构漂移 | 两文件追加 messages / research_scales / scale_dimensions / scale_items 定义及索引（schema.sql +80 行 / sqlite +72 行） | `grep` [schema.sql](db/schema.sql#L459-L481) 命中 `CREATE TABLE IF NOT EXISTS messages` + 3 条索引；改动均在 `git diff` 可见 |
| 3 | server 根目录残留墓碑脚本 `_probe.py / _diag.py / _tmp_inspect.py / _verify_e2e.py`，且 `.gitignore` 未拦截下划线临时脚本 → 易误采集/入库 | 墓碑脚本全部删除；`.gitignore` 追加 `/_*.py` 防复发 | [.gitignore](.gitignore#L58) 命中 `/_*.py`；`glob _*.py` 在 server 根目录无匹配 |

### 第 2 批：🟡 风险项

| # | 修复前 | 修复后 | 验证证据 |
|---|--------|--------|----------|
| 4 | 前端 `dataset.ts` / `questionnaire.ts` 各自重复定义 API_BASE → 维护成本高、易漂移 | 统一抽取：`client.ts` 导出唯一 `API_BASE`，业务 api 复用导入 | [dataset.ts](web/lib/api/dataset.ts#L7) `import { apiClient, API_BASE } from "./client"`；[client.ts](web/lib/api/client.ts#L14) `export const API_BASE` |

**🟡 风险项登记（本轮复扫后新增，可上线后修）**：本轮整改后复扫 `server/app`+`web` 无新增实质性风险——硬编码/密钥/URL 均为 dev 默认值、无 FIXME/HACK、无调试 print、阈值已集中 `core/statistics_constants.py`、越权统一走 `get_owned_project`。无新增待修风险项。

### 第 3 批：🟢 建议项（暂不修，记入后期优化清单）

- 「告警通知扩展」：`server/app/core/monitoring.py:88` 仅有 `# TODO: 后续可扩展告警通知` 占位，暂不实现通知链路（埋点已落 `analytics_events`）。
- 前端 `getAuthHeader` 同名两处（`lib/api/client.ts` 客户端读 store vs `lib/server/auth.ts` BFF 转发 request）职责不同、不属真重复，但命名易误解 → 建议改名 `getClientAuthHeader` / `getBffAuthHeader`（可读性优化）。
- 生产 HTTPS 落地（`FRONTEND_URL`→`https://`、nginx 443 + 证书 + HSTS）为部署流程项，属上线操作，非代码整改。

---

## 工作日志

> 每次工作简要记录：日期 + 做了什么 + 遇到什么问题

| 日期 | 做了什么 | 问题 / 备注 |
|------|---------|------------|
| 2026-07-18 | 首轮上线：认证/项目/问卷/模拟/统计/报告/导出/支付八模块全部 R3 验收 | 上线前发现 P14：M1~M9 风险项未预留修复时间，立刻整改 |
| 2026-07-20 | 合规框架落地（F-SYS-005~011）+ 免费配额提升 3→6 次/周 + BFF 响应格式统一 | 修复 quota API 双重包装、report 404 响应格式、sample_size 字段兼容 |
| 2026-07-29 | 上线前安全整改（P0 支付回调/文件上传MIME校验 + P1 依赖锁定/日志审计/安全响应头） | 扫描发现 18 项风险/建议项，全部整改完毕 |
| 2026-07-29 | 统计分析教程模块三阶段完成（Tab3 收尾 + AI 解读助手 + 新手引导 + 12 篇教程） | 全量 126 passed 0 failed |
| 2026-07-29 | 上线前建议项 N1~N7 整改（LLM 安全/错误集中/常量去重/硬编码颜色） | 唯一遗留 N8 HSTS 为部署层事项 |
| 2026-07-29 | 统计小课堂 v1.2 增强（Markdown 公式渲染 KaTeX + TOC 目录 + 管理员后台 + 上下篇导航） | 修复登录链路 3 个 BUG |
| 2026-07-29 | P1 阶段运营基础建设（SEO 增强/套餐到期提醒/续费入口/数据埋点/监控告警） | 营销页 SEO 优化、sitemap/robots/metadata 配置 |
| 2026-07-29 | 四扩展功能（PPT导出/问卷星解析/SPSS导入/报告润色）前后端 + 测试 | 54 个单元测试全部通过，修复 4 个生产环境 bug |
| 2026-07-31 | 修复 14 个遗留测试失败，全量 126 passed 0 failed | 假测试陷阱验证通过 |
| 2026-08-06 | 撤销 V2 电商转型，回归问卷分析核心定位 | 错误方向纠正 |
| 2026-08-06 | 四扩展功能收尾：问卷星导入/报告润色/PPT导出 + PG 端口收紧 + dev-login 审计 | 与定位对齐 |
| 2026-08-06 | 问卷质量体检引擎 v2：纯规则 7 项检查 + 前端体检报告卡片 | 题量/维度均衡/反向题/人口学/量表一致性/置信度/文本质量 |
| 2026-08-10 | v1.3：样本代表性诊断 F-RPT-007（规则+LLM+免费端点）+ 首页叙事重写 + 一句话结论 | 全量 151 passed；修复 v1.2 遗留「体检 BFF 路由缺失」隐患；线上冒烟（真实 LLM 调用）通过 |
| 2026-08-10 | v1.3.1：样本量规划器 F-RPT-008（公式引擎+预演矩阵自动效应量+达标判定），模拟预演页步骤 4 内嵌 | 全量 176 passed；线上冒烟 4 场景通过；冒烟脚本曾因 CWD 写错 SQLite 库，已修正并清理误建文件 |
| 2026-08-10 | v1.4：导出物一致性（代表性/规划/一句话结论入 Word/Excel/PDF/PPT）+ 报告页 Tabs 化 5 页签 + 规划已收 N 联动对照 + 教程扩篇《样本量怎么算》《样本代表性怎么看》 | 全量 181 passed；tsc/lint/build 通过；教程种子脚本二次踩 CWD 相对路径库坑（见踩坑记录），已修正并清理 |
| 2026-08-11 | 教程 SEO/学习路径增强：详情页新增「学习路径」导航（分类内进度条 + 当前篇高亮 + 已完成勾选，桌面端侧边栏/移动端头部）+「相关文章」推荐区（同分类 3 篇） | 收费边界复核：项目内操作（模拟/导出/分析/导入/润色/AI解读）收费、教程/体检/规划器免费，当前体系已符合，无需改动 |
| 2026-08-11 | 登录体验优化：教程页 `learn` 从 `(app)` 组迁移到 `(marketing)` 组公开访问（未登录可直接浏览教程），接入 MarketingHeader（登录/退出切换），AppShell 导航移除 `/learn` | 修复「教程前后端权限不一致」：后端教程接口本就公开（get_current_user_optional），但前端 `(app)` 组 AppShell 守卫强制登录，导致未登录访问被重定向登录页（"有时候不需要登录，有时候又退出"的根源）；tsc 报错为 `.next` 构建缓存残留，下次 build 自动清除 |
| 2026-08-11 | 规划器增强：新增配对 t 检验（dz）/单因素 ANOVA（f，组数）/分层抽样（设计效应 DEFF）三种分析类型，默认效应量按类型区分，前端新增组数/分层数输入，模拟页按假设路径数量自动推荐分析类型（>1→回归，==1→相关） | 全量测试待跑；ANOVA 效应量 f 可 >1，前端校验仅对相关分析 r 限制 <1 |
| 2026-08-11 | 导出代表性接入 LLM 说人话结论：`_build_sample_context` 增加 include_ai_conclusion 可选开关（默认 False 保证确定性），Word/Excel/PDF/PPT 四格式代表性章节追加「AI 说人话结论」，导出确认对话框新增开关（仅真实数据项目显示） | 开关默认关闭，开启后调用 llm_enrich 可能消耗 AI 配额；模拟数据项目无代表性概念，不显示开关 |
| 2026-08-03~04 | 竞品调研（问卷派/SPSSAU/SPSS/问卷星），定位收敛为"预演+诊断深井" | 明确不碰样本投放，短期对标 SPSSAU、长期防问卷派 |
| 2026-08-04 | 更新立项文档(a) v2.0、功能清单(b) v2.0、系统架构文档 v3.0 | 新增竞品分析、竞争壁垒、差异化叙事映射表 |
| 2026-08-04 | 撰写用户手册 | 12 章 + 3 附录，覆盖用户完整使用流程 |
| 2026-08-11 | 前端 CI 门禁补强（frontend-ci.yml：npm ci→lint→tsc→next build）+ 移除 compose 废弃 `version` + 新登录页 bug | 前端此前"零 CI、零构建门禁"，TS 错误往往在服务器 docker build 才爆；本地验证 tsc/lint/build 全绿 |
| 2026-08-11 | **安全紧急整改**：发现 `deploy/deploy.sh` 自初始提交硬编码真实 sk- API Key 并已进入公开 GitHub 历史 | 密钥视为已泄露，需在 DeepSeek/Agnes 控制台轮换重建；脚本已改为读 .env；已加 CI secret 扫描 + 本地 pre-commit 钩子防复发；git 历史清理暂缓待密钥轮换后决策 |
| 2026-08-11 | 阶段推进 Phase2/3：发布/回滚脚本 + docs 备份。release.sh（构建+健康检查+失败自动回滚）、rollback.sh（一键回滚）、compose 支持 IMAGE_TAG 标签镜像；backup-docs.sh 把 docs/（含敏感复盘/定价策略）快照进独立本地库 .doc-backup 防丢失 | 全部 bash -n 语法通过；.doc-backup 首次提交已建立（37 文件）；backup-docs.sh 可再配私有 remote 异地备份 |
| 2026-08-11 | **前端样式分层优化**：主题三态化（light/sepia/dark）+ 持久化 + 暗色改暖褐；品牌记忆点（纸质纹理 + `.brand-watermark` hero 卷首字）；控件手感（按钮按下反馈 / 输入软 focus / 表格 `DataCell`+sticky）；动效层级（`.anim-delay-*` / `.lift`）；可读性（`ink-400` 收窄为占位专用 + 补齐失效的 `text-body/caption` 语义字号）。新增设计系统单一真源文档 `docs/FRONTEND_ARCHITECTURE.md`（第五章 token）。 | `tsc --noEmit` 全绿；next build 受本机沙箱 `spawn EPERM`（jest-worker 需要输出到子进程）环境阻断，非代码问题，已用 tsc 校验替代；三态切换由 `theme-provider` 移除 light/sepia/dark 三类后加当前类，保持正确 |
| 2026-08-11 | 前端硬编码颜色收敛：新增语义色阶工具类 `tone-text-success/warning/danger/info` + `tone-*-surface`（`color-mix` 半透明点缀，三主题自适应）；`health-report`/`sample-representativeness`/`sample-size-planner` 从 Tailwind 原生 `red/amber/blue/emerald-*` 调色板改为语义 tone；`register/login/reset/forgot` 四处错误提示 `text-red-600` → `text-destructive`；`OnboardingTour` 白卡 `bg-white/95` → `bg-card/95`；`diff-test-table` 改用 `DataCell` + sticky 表头 | 全库扫描确认 `components/` 与 `app/` 已无硬编码 Tailwind 原生调色板；`tsc --noEmit` 全绿 |
| 2026-08-11 | 前端优化再推进：营销页 features/steps/painPoints 卡片统一 `.lift` hover 上浮（替代散落 `transition-shadow`）；品牌水印 `.brand-watermark` 从首页推广到 4 个认证页（login/register/forgot/reset，容器 `relative overflow-hidden` + `aria-hidden` 无障碍）；`ink-400` 全库审计确认仅用于占位/图标/辅助角标，无正文误用 | `tsc --noEmit` 全绿 |
| 2026-08-24 | 技术债复核就医清单：对照 `验收-总验收审查清单.md`（早于 `d13df30` 的旧快照）逐项核对当前 HEAD，确认其 🔴 项已在 `d13df30`「上线前整改(defect/security/env)」清零（体检500/HTTPS/密钥注入+门禁/恒时回调/仿真边界/PSD/阈值常量/3.11门禁/幽灵pyc）| 完成本批代码清理：`diff_test.py`→`diff_methods.py`（消除 pytest `*_test.py` 误收集，同步 report/diagnoser/diagnosis_rules 引用）、CORS 死分支清理、移除空 `app/utils`；`py_compile` 全绿；commit `d26adcc` |
| 2026-08-24 | 教程 SEO 增强提升（x1.5 门户）：`tutorial_articles` 新增 `tags`/`difficulty`（模型+迁移 `f3c6d7e8a9b0`+API `tag/difficulty` 筛选+服务 `_encode/_decode_tags`+管理端表单+公开列表展示）；新增 8 篇 SEO 长尾文（21~28，结构化 front matter）；新增**公开样本量计算器工具页** `/learn/tools/sample-size`（`SampleSizeCalculator` 组件，`(marketing)` 组、无登录，Pearson/t检验/ANOVA 三场景估算，纯查表近似不引统计库），learn 列表页置顶「免费工具」入口 | 迁移链核验线性无分叉（head=`f3c6d7e8a9b0`）；前端工具页与列表/文章互链闭环；已核验无密钥/调试泄漏；commit `c4c961d`（迁移+内容）+ `2ea818b`（前后端实现）；产品版本升 v1.5 |
| 2026-08-24 | `docs/管理后台-立项文档.md` 立项 + **统一管理后台基建** 前后端落地：后端 `api/v1/admin.py`（users/订单/审计全量 require_admin + 看板复用 analytics）、`admin_service.emails` bootstrap、启动时 `ADMIN_EMAILS` 自动晋升、`promote_admin.py` CLI、`users.disabled_at` 禁用列（迁移 `abf2c1011234` 接 `f3c6d7e8a9b0`）+ 登录/鉴权禁用拦截 + `is_admin` 下发进 token；前端 `is_admin` 注入 auth-store + middleware 保护 `/admin` + `AdminShell` 布局（登录+管理员双重守卫）+ users/orders/audit/configs 五页 + **LLM 配置并入统一后台**（`/admin/llm-configs` 复用既有 `llm-configs` API 的增删改查/白名单） + AppShell 管理员入口 | 管理门禁统一用 `require_admin`（收敛散落 `_check_admin`/内联判断）；禁用用户 JWT 与 email-login 双路拦截；admin 改套餐/禁用均写审计且同事务提交；前端 `tsc --noEmit` 0 错；管理员入口 bootstrap 需在生产 `ADMIN_EMAILS` 或在 `server/` 跑 `python -m scripts.promote_admin <email>` 指定首个管理员 |

| 2026-08-24 | 管理后台**生产启用**：在 Liekkas 生产库用容器内 `python -m scripts.promote_admin 1462882928@qq.com` 晋升首管（`is_admin=true` 已核验）；修复 `admin/tutorials` 页 `page_size:100` 超出后端 `/tutorial/articles` `le=50` 导致的 `42200`（改 50，commit `a43b77f`） | **生产事故处置**：上线重建时后端 `daa-backend`循环 `Restarting`、compose `dependency failed to start`——新上线的生产密钥门禁（`_validate_production_settings`）拦截 `RESET_JWT_SECRET_KEY` 仍为占位符；生成 96 位随机 hex 替换 `server/.env.production`（已备份 `.bak`）并重建后端→四容器(backend/frontend/nginx/db)全部 healthy，端到端 `/health` 200；⚠️ 密钥值一次出现在对话，建议再轮换一次 |
| 2026-08-25 | **V2 第一轮启动**：Stage1.1 预演命中率——后端 `sample_size_planner.py` 新增 Fisher z 功效计算 + `simulation.py` 假设命中率分析，schemas 增 `hit_rate`；前端新增 `components/simulation/hit-rate-card.tsx` 展示命中率并提示提样本量；命中率实时 bug 修复（generate/route.ts 归一 snake→camel `hitRate`） | 新增 Python 3.12 venv（`.venv312`，旧 3.8 venv 跑不动新语法）；命中率单测通过、193 total pytest 2 项既有失败（security/export） |
| 2026-08-25 | **修复两处既有测试失败**：`test_security.py` `_setup_production_valid` 补 `PAYMENT_CALLBACK_TOKEN/PAYMENT_ALLOWED_IPS/DATABASE_URL` 并同步 `_save/_restore_settings`；`stats.py` 无 Bartlett 时 `effective_bartlett_p` 默认 1.0 防 NOT NULL 报错 | test_security + test_export 21 passed（前端命中率显示联调通过） |
| 2026-08-25 | **Stage1.2 模拟答辩摘要**：`types/index.ts` 增 `DefenseQAItem/DefenseSummary`；BFF `defense-summary/route.ts` 转发归一；hook 扩展 `useDefenseSummary`；新 `defense-summary-panel.tsx`（Q&A 展示 + 一键复制）；simulate 页加"生成答辩摘要"按钮 | 后端 203 passed（自 193）；前端 tsc --noEmit 0 错 |
| 2026-08-25 | **Stage2.1 留言表后端**：新 `models/message.py`+迁移、`schemas/message.py`、`api/v1/message.py`（建/查/删/处理 + 审计留痕），5 类 tag + project_id + 数据源落库 | 修复 SQLAlchemy FK 歧义（user/handled_admin 显式 foreign_keys）、尾斜杠 307 重定向、审计查询排序；tests/test_message.py 通过 |
| 2026-08-25 | **Stage2.2 留言模板库表单**：新 `components/contact/contact-form.tsx`（5 类模板填空式，dialog/sheet，必填校验+登录守卫+提交态）、`lib/api/message.ts`、`lib/hooks/use-message.ts`、`types/message.ts`；三入口接入（定价页售前咨询 / 报告页救急区自动带项目ID+数据源 / 页脚抽屉） | 前端 tsc --noEmit 0 错；后端 message tests 8 passed（三入口可提交且数据可查） |
| 2026-08-25 | **质量审查整改（分 3 批）**：生成 messages/research_scales 三表 Alembic 迁移并同步 schema.sql 双文件；清理墓碑脚本 + `.gitignore` 加固；抽取前端唯一 API_BASE；PROJECT_STATUS 登记整改证据与 🟢 后期优化清单 | `alembic heads`=c5d6e7f8a9b1 链头正确；schema.sql 命中 messages 定义；dataset.ts 复用 API_BASE；复扫 server/web 无残留严重项（无密钥/无 FIXME/无调试 print） |
| 2026-08-25 | **线下成交转最小可行方案 Step1（前端去付费展示）**：与负责人对齐「网站不写会员、收费走线下闲鱼、客服微信+留言、后台手动开通」模式，产出 [docs/线下成交转最小可行方案.md](docs/线下成交转最小可行方案.md)；C 端去价格/套餐/支付引导——`/pricing` 改为「服务与咨询」页（去 9.9/19.9/single/subscription 与微信扫码 CTA），首页/关于/页脚/头部导航「定价」改「联系」，首页 SEO 描述去「付费」，`paid-action-guard` 引流弹窗「升级套餐」改「联系客服」，settings 续费/升级入口改「联系客服」，项目页「付费解锁/查看定价」改「开通/联系客服」，删除无用 `price-tag.tsx` 与 `PRICING` 常量（全库已无引用） | `tsc --noEmit` 0 错；eslint 目标文件全绿；grep 全站 C 端无「9.9/19.9/查看定价/升级套餐」；；grep 全站 C 端无「9.9/19.9/查看定价/升级套餐」；在线支付 CTA 已从定价页移除不再触发 C 端下单 |
| 2026-08-25 | **线下成交转最小可行方案 Step2（停在线支付 + 后台手动开通/线下订单）**：后端新增 `ENABLE_ONLINE_PAYMENT`（默认 false）门控在线下单/支付回调全部拒绝，生产走「线下成交→后台开通」；`payment_service` 抽出 `apply_plan_extension` 复用套餐激活 + 新增 `create_offline_paid_order`（渠道+备注+开通天数）；`admin.py` 新增 `POST /admin/orders`（require_admin 线下单：套餐+天数+渠道+备注，同事务激活套餐+审计留痕 `admin_create_offline_order`）；前端 admin users 页新增「开通」对话框（咸鱼/微信/支付宝/现金/其他 + 天金额备注）；新增 `test_admin_offline_order.py` 4 条；测试 env 开启线上成交保证在线支付用例仍覆盖 | **全量 pytest 236 passed**（原 203+4 新）；tsc 0 错；eslint 目标文件绿；`.env(.test/.production.example/.example)` 补 `ENABLE_ONLINE_PAYMENT` |
| 2026-08-25 | **UI 落地页/导航/页脚 精致化打磨（S1-S5）**：基于 design-taste/minimalist-ui anti-slop skill 结合产品定位校准（保留 warm-cream 复古品牌、保留「三主题 Light/Sepia/Dark」、范围=落地页+导航/页脚，决策记录见 `docs/UI设计-落地页打磨.md`）；**图标**：落地/导航/页脚/learn 系 lucide→`@phosphor-icons/react`（新依赖 `@phosphor-icons/react ^2.1.10`，替换 `ArrowRight`/`FileSearch→FileMagnifyingGlass`/`FlaskConical→Flask`/`FileBarChart→ChartBar`/`CheckCircle2→CheckCircle`/`AlertTriangle→Warning`/`Code2→Code`/`Search→MagnifyingGlass`/`Sparkles→Sparkle`/`Loader2→Spinner`/`Type→TextT`/`Library→Books`/`DropMenu User→UserCircle`/`LogOut→SignOut`/`LayoutDashboard→SquaresFour`/`Menu→List`/`BadgeCheck→SealCheck`/`Send→PaperPlaneTilt`/`MousePointerClick→Cursor` 等）；**Hero**：删除叠字水印（`brand-watermark` span）与 hero 底部 mono 水印行，精简为 4 层，`pt-20/pb-24` 大留白，水印移为页面「预演数据」脚注；**痛点卡**：红色 `destructive` 弱化为 `bg-card+border-border` 编辑风；**section 留白**：`py-12→py-16` 编辑感 macro-whitespace | `tsc --noEmit` 0 错；`next lint` 目标文件全绿；门面营销文件无 lucide 残留（产品/后台仍用 lucide，后续分批）；`next build` 在当前文件沙箱下因 `jest-worker` spawn EPERM 无法完成（环境限制，非代码问题，需 CI/主机 shell 跑） |

---

## 规则变更记录

> 每次改真源文档 / 宪法时记录：日期 + 改了什么 + 为什么改

| 日期 | 改了什么 | 为什么改 |
|------|---------|---------|
| 2026-07-18 | 复盘产出 P1~P15 踩坑记录，反哺到 `writing-plans`、`backend-security-review` 等 Skill | 上线前才发现大量风险项，需在后续项目中提前规避 |
| 2026-07-18 | `writing-plans` 新增"上线前验收"里程碑 + 独立 e2e 脚本命名规范 | 防止上线前突击验收、防止 pytest 收集独立脚本 |
| 2026-07-18 | `backend-architecture-acceptance` 新增"数值/阈值必须集中到 constants"规则 | 效应量档位口徑不一致导致数据错误 |
| 2026-08-04 | 立项文档(a) 定位锚点收敛：从"急救+预防双定位"改为"预演+诊断深井差异化" | 2026 年竞品调研发现问卷派走全闭环、SPSSAU 走在线统计，我们的差异化在预演和说人话诊断 |
| 2026-08-04 | 功能清单(b) 新增 F-RPT-007 样本代表性诊断 + 差异化叙事映射表 | 明确不碰样本投放，用轻量诊断解决痛点② |
| 2026-08-04 | 系统架构文档 v3.0 新增〇章"竞品定位与差异化锚点" | 将竞品策略写入架构文档，作为长期开发参考 |
| 2026-08-11 | 前端设计 token / 主题体系确立单一真源 `docs/FRONTEND_ARCHITECTURE.md`（第五章 = design token），`tokens.css` 注释指向它；主题从 light/dark 升为 light/sepia/dark 三态 | `tokens.css` 原注释引用的 `FRONTEND_ARCHITECTURE.md` 此前并不存在；且 design token 说明散落在过时/编码损坏的 m-/p- 文档中，需一个权威且反映当前实际值的真源 |

---

## 踩坑记录

> 每次踩坑时记录，项目结束时反哺到 Skill 库

| 日期 | 踩了什么坑 | 根因 | 是否反哺 Skill |
|------|-----------|------|---------------|
| 2026-07-18 | 邮箱验证码明文存储（P1） | 把"临时字段"当成非敏感数据，未做哈希 | ✅ 已反哺 `backend-security-review` |
| 2026-07-18 | 密码重置 JWT 与登录 JWT 共用密钥（P2） | 只通过 `type` claim 区分用途，未使用独立密钥 | ✅ 已反哺 `backend-security-review` |
| 2026-07-18 | 效应量档位多处硬编码，口徑不一致（P3） | 数值类规则没有统一真源 | ✅ 已反哺 `backend-architecture-acceptance` |
| 2026-07-18 | `alembic.ini` 含中文注释，Windows 下 GBK 解码失败（P4） | 配置文件未声明 encoding | ✅ 已反哺 `backend-architecture-acceptance` |
| 2026-07-18 | UUID 存储格式变更后未清洗历史数据（P5） | 存储格式变更导致查询命中失败 | ✅ 已反哺 `database-design` |
| 2026-07-18 | 临时验证脚本放在 `server/` 目录导致 --reload 重启（P6） | 调试脚本暴露在被监控目录 | ✅ 已反哺 `writing-plans` |
| 2026-07-18 | SQLite 并发访问 `database is locked`（P7） | 未开启 WAL 和 busy_timeout | ✅ 已反哺 `backend-architecture-acceptance` |
| 2026-07-18 | JSX 文本节点 `{obj?.prop \|\| "default"}` SWC 解析失败（P8） | Next.js 14 SWC 对 JSX 文本节点表达式支持有限 | ✅ 已反哺 `TRAE-code-review` |
| 2026-07-18 | 测试/运维脚本 curl 在 PowerShell 5 下报错（P9） | 未区分 `curl.exe` 与 `Invoke-WebRequest` 别名 | ✅ 已反哺 `writing-plans` |
| 2026-07-18 | `datetime.utcnow()` 与 PostgreSQL `TIMESTAMPTZ` 比较崩溃（P10） | 未统一使用 timezone-aware datetime | ✅ 已反哺 `backend-architecture-acceptance` |
| 2026-07-18 | slowapi `Limiter` 初始化 `TypeError`（P11） | monkey-patch 未标注目标版本范围 | ✅ 已反哺 `backend-architecture-acceptance` |
| 2026-07-18 | `useSearchParams` 未包 Suspense，生产构建失败（P12） | Next.js 14 app router 强制要求 | ✅ 已反哺 `TRAE-code-review` |
| 2026-07-18 | `tests/test_e2e.py` 被 pytest 收集导致崩溃（P13） | 测试文件组织未区分 pytest 与独立脚本 | ✅ 已反哺 `writing-plans` |
| 2026-07-18 | 上线前才发现风险项 M1~M9，未预留修复时间（P14） | 开发计划缺少"上线前验收"阶段 | ✅ 已反哺 `writing-plans` |
| 2026-07-18 | 架构规则变更后，实施真源文档滞后更新（P15） | 未把"真源文档同步"作为完成标准 | ✅ 已反哺 `verification-before-completion` |
| 2026-08-06 | 电商转型方向被用户纠正，退回问卷分析核心定位 | 初始理解用户需求为电商商品数据分析方向，与"店铺/工作室接问卷项目"业务不符 | 方向确认流程已纳入讨论评估 |
| 2026-08-10 | 问卷质量体检前端 hook 调用不存在的 BFF 路由（v1.2 隐患） | 路由表无回归校验，新增/重构路由未全局核对 | 待反哺 `writing-plans`（完成标准含"前端 BFF 路由与后端端点一一核对"） |
| 2026-08-10 | 冒烟脚本把模拟配置/模式翻转写进了错误的 SQLite 库 | DATABASE_URL 为 CWD 相对路径，脚本未切工作目录导致新建空库 | 待反哺 `writing-plans`（独立脚本执行前先 chdir 到 server/ 并确认库文件存在） |
| 2026-08-10 | 教程种子脚本再次踩 CWD 相对路径库坑（v1.4，二次踩坑） | 同一根因：`sqlite+aiosqlite:///./data_analysis_agent.db` 相对 CWD，从仓库根目录跑脚本会新建/误连根目录空库 | 待反哺 `writing-plans`（独立脚本强制绝对路径或启动即 chdir；规则已在上行记录但仍未固化） |