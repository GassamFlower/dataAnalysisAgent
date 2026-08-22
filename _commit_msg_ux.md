feat(ux): 体验极致化 M1-M4 动效与引导升级

M1 全局动效基础设施（framer-motion）
- 新增 components/motion/reveal Reveal/Stagger/StaggerItem（尊重 prefers-reduced-motion）
- 营销首页 Hero/痛点/三步/特性/信任 区块接入滚动叙事 + hover 微交互
- 项目工作台、报告页入口接入淡入动效

M3 报告页过渡 + 全局微反馈
- tabs.tsx 每次切签重放淡入动画（CSS keyframes 对齐 tokens 缓动）
- globals.css 新增可复用 anim-fade-up 工具类（含 reduced-motion 降级）

M2 首页「报告预览」首次印象
- 新增 components/marketing/report-preview：用真实示例指标排版的成品预览，
  让外行在回收前看懂"要交的报告长什么样"

M4 空态 → 下一步进度感
- 新增 components/projects/first-run-guide：无项目时展示"三步拿报告"向导
  替代纯空态，降低首次上手放弃率

另：用户已确认被泄露 API 密钥已轮换且数据库未暴露 → 安全线闭环，
无需再做 git 历史清理。