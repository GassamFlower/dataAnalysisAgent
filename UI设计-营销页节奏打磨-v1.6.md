# UI 设计打磨（二）· 营销落地页节奏与构图（design-taste / imagegen-frontend-web / brandkit）

> 生成时间：2026-09-04
> 关联：[docs/FRONTEND_ARCHITECTURE.md]（token 真源）、[docs/UI设计-落地页打磨.md]（上轮 S1-S5 落地页打磨）、`web/styles/tokens.css`
> 依据：本轮加载 **brandkit**（品牌克制/色彩纪律）+ **design-taste-frontend**（anti-slop 落地页准则）+ **imagegen-frontend-web**（每节构图/背景节奏），按产品定位校准后采用。
> 裁决：**延续 warm-cream 复古期刊品牌（preserve-modernise，非推翻）**；三主题统一打磨；本轮聚焦**营销落地页（首页）的「区块节奏/构图多样性/间距起伏」**与 marketing 段一致性收口。产品端/后台不越界。

---

## 一、Design Read（设计判读）

一句话：
> Reading this as: **本科毕设学生研究预演工具的 C 端落地页 + 导航/页脚**；
> 受众 = 信任优先的学生研究者（非炫技消费者）；
> 语言 = **学术编辑 & 期刊卷首 & 复古纸质感**（既有品牌）；
> 倾向设计系统 = **warm-cream / ink / brick 现有 token（reserve-modernise）**；
> 动效 = 克制（错峰 fade-up，非无限循环）；图标 = 门户级图标库（历史决策见上轮）。

**Dials（落地页适用）：**
- `DESIGN_VARIANCE: 7`（编辑排版允许中等不对称，比上轮 6 略放开以破除“同款卡平铺”）
- `MOTION_INTENSITY: 5`（错峰入场、悬停微抬；不用 GSAP/Three）
- `VISUAL_DENSITY: 3`（大留白、max-w 限行长）
- `IMAGE_USAGE: 4`（工具型营销页，无照片素材；以真实 UI 预览/demo 为“图像材料”，遵循 imagegen“产品面板堆叠/UI crop 作视觉”精神）

---

## 二、设计令牌（现状 → 保留/调整）

沿用现有 `web/styles/tokens.css`，本轮只做校准、约束、不新增散落值：

| 令牌 | 现状 | 本轮动作 |
|------|------|---------|
| 背景 `--bg-base #faf7f2`/`--bg-surface` | cream 暖白 | **保留**（Light 默认） |
| 前景 `--ink-900/700/500/400` 非纯黑 | 暖墨 | 保留；正文用 700，辅助 500，禁用 400 |
| 强调 `--accent-brick #b5564b` / indigo / olive | 复古暖 | 保留；brick 用于主 CTA，不滥用大面积 primary 背景 |
| `--chart-1..6` 低饱和暖色板 | 已含色盲校验 | 保留 |
| 字体 display=Fraunces+Noto Serif SC / sans=Noto Sans / mono=JetBrains | 衬线+无衬+等宽 | 保留品牌衬线；只打磨排版（tracking/weight/行高） |
| 圆角 `--radius-lg:10px`/`xl:16px` | 紧凑 | 落地页卡片统一 radius-lg；不用 rounded-full 大容器 |
| 阴影 `--shadow-*` | 暖灰低不透 | 落地页默认无影或 shadow-xs |

> 注：design-taste 对 Fraunces/warm-cream 的默认禁令**不适用**——本产品真实品牌定位是"学术复古期刊"，属其豁免条款（editorial/literary + 已有品牌资产），且 Redesign-Preserve 协议要求不推翻既有品牌。

---

## 三、首页结构诊断（现状 → 本轮打磨）

对照三技能检查项（Section-Repetition、Bento Rhythm、Spacing Rhythm、Hero Stack、CTA Intent），首页问题与动作：

| # | 区块 | 现状问题 | 本轮动作 | 优先级 |
|---|------|---------|---------|--------|
| L1 | Hero | 居中 4 元素合规（Badge/H1/副文/2CTA），`pt-20` ≤ 上限 | **保留**；副文已 ≤ 20 词 | — |
| L2 | 痛点区(py-8) → 流程区(py-16) → 功能区(py-16) | **三连同款「图标卡 + 文字」网格**，imagegen 点名布局家族重复 | 三区差异化：痛点改**不对称 2+2 叠排 + 编号序**；流程保留 3 列但**纵向时间线 + 右侧序号大衬线**；功能改 **1 大 + 3 小 bento 混合** | P0 |
| L3 | 三区标题全居中 `text-h2` | 结构单调 | 痛点标题**左对齐 editorial**；流程居中；功能左对齐 + 右侧一句话说明（split-header 禁区规避：竖排栈） | P1 |
| L4 | 图标容器两套：痛点 `bg-surface`，流程/功能 `bg-primary/10` | 不一致 | 统一 **bg-primary/10 text-primary**（brick 调）；痛点区沿用 | P1 |
| L5 | 区块间距全 py-16 平铺 | 无“安静-功能-情感-技术”起伏 | 间距阶梯：hero 大留白 → 痛点紧(py-10) → 报告/流程中 → 功能多 → 信任收束 | P1 |
| L6 | 页脚 信任/服务 CTA 重复「联系客服」意图 | 首页内 contact 意图出现 ≥3 次（CTA、导航、页脚、about 页亦同） | 收敛：主 CTA 标签统一「联系客服」，页脚不再独立重复大按钮（保留链接文本） | P1 |
| L7 | marketing 无共享 layout | pricing/about 已在本轮改用共享 MarketingHeader；仍有 footer 重复 | 抽 `MarketingFooter` 组件（页脚含客服微信/留言/导航）供 home/pricing/about 复用 | P2 |

---

## 四、打磨边界与禁入（遵守技能 Pre-Flight 的落地部分）

- **不引入**：照片素材、假 dashboard、竖版截图、无限 marquee、假 KPI 三连、AI 渐变紫、手写装饰 SVG。
- **Hero**：不超 4 文本元素；顶部 padding ≤ pt-24；CTA 单行不换行。
- **CTA 意图唯一**：整站「开始/联系」各一个主标签。
- **形状一致**：卡片 radius-lg；图标容器 rounded-lg。
- **动效克制**：沿用 Reveal/Stagger；reduced-motion 关闭；不新增 scroll-hijack。
- **空/载/错态**：营销页不涉及（无数据区）。
- **导航单行 ≤80px**：现 MarketingHeader 符合，本轮不再动。

---

## 五、验收方式（本轮代码改动后）

- `cd web && npx tsc --noEmit` 通过。
- 本地 `npm run dev` 目测首页三区节奏与营销段 header/footer 一致性（如需自动验证跑 server/e2e_smoke.py 页面 200）。
- 生产部署后 nginx 抽查首页 200。

---

## 六、后续（不在本轮）

- learn 段（learn/scales/[slug]）字号/宽度别名收敛（上轮已列 P2）
- BrandLockup 组件化统一（一文一图）
- 认证页 FOUC 前置脚本
