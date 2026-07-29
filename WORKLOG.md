# 工作日志（Worklog）

> 项目：数据分析智能体（dataAnalysisAgent）
> 统计区间：2026-07-01 ~ 2026-07-20
> 提交总数：50 次
> 作者：LYG
> 生成时间：2026-07-22

---

## 一、整体概览

| 维度 | 数据 |
|------|------|
| 提交总数 | 50 |
| 时间跨度 | 2026-07-01 ~ 2026-07-20（共 20 天） |
| 主要分支 | main |
| 首次提交 | `37019ca` 2026-07-01 添加 LICENSE |
| 最近提交 | `882b169` 2026-07-20 微信扫码按钮待上线提示 |
| 涉及模块 | 部署/运维、认证、项目管理、问卷、模拟、报告、用户中心、支付/配额、合规、教程 |

### 阶段里程碑

| 阶段 | 时间 | 主题 |
|------|------|------|
| M0 | 07-01 | 仓库初始化 |
| M1 | 07-13 | 项目骨架搭建 + Docker 部署 |
| M2 | 07-14 | JWT 认证链路 + BFF 层重构 + 部署修复 |
| M3 | 07-15 | 微信扫码登录 + 邮箱注册 + 路线图规划 |
| M4 | 07-16 | PostgreSQL 端口外放 |
| M5 | 07-18 | 问卷模块 R3 验收 + 认证/项目管理 R3 验收 |
| M6 | 07-19 | 用户中心 + 多 LLM 提供商 + 邮件异步化 |
| M7 | 07-20 | 免费配额系统 + 合规框架 F-SYS-005~011 + BFF 响应规范化 |

---

## 二、按时间线整理的提交记录

### 阶段 M0：仓库初始化

| 时间 | Hash | 类型 | 说明 |
|------|------|------|------|
| 2026-07-01 14:37 | `37019ca` | chore | Initial commit（添加 LICENSE） |

---

### 阶段 M1：项目骨架 + Docker 部署（07-13）

| 时间 | Hash | 类型 | 说明 |
|------|------|------|------|
| 07-13 17:27 | `044a489` | feat | 初始化项目并添加 Docker 部署配置（一次性提交 210 个文件，约 27698 行） |
| 07-13 20:26 | `47bdefa` | fix | Docker 构建安装完整依赖（含 devDependencies） |
| 07-13 21:02 | `f17e63c` | fix | 修复 ESLint 引号转义错误 |
| 07-13 21:06 | `d480115` | fix | 修复 TypeScript 类型错误 - cells.length 可能为 undefined |
| 07-13 21:12 | `38769b5` | fix | 修复 Docker 构建 public 目录不存在问题 |

**阶段产出**：
- 后端 FastAPI 骨架（api/core/models/schemas/services/utils）
- 前端 Next.js 14 骨架（app 路由组、shadcn/ui 组件、lib/api/hooks/stores）
- Docker Compose + Nginx + 数据迁移脚本
- 完整设计文档（架构/数据库 schema/技术资源/用户手册等）

---

### 阶段 M2：JWT 认证链路 + BFF 重构 + 部署修复（07-14）

| 时间 | Hash | 类型 | 说明 |
|------|------|------|------|
| 07-14 08:23 | `5b987fa` | fix | 修复 Nginx 配置，所有请求统一走 Next.js BFF 层 |
| 07-14 15:45 | `b020cfa` | feat | 实现完整 JWT 认证链路（dev-login 端点 + 前端登录页 + apiClient 自动附加 Authorization 头） |
| 07-14 19:15 | `90dd197` | fix | Dockerfile 使用清华镜像源解决国内网络访问 PyPI 问题 |
| 07-14 19:27 | `e7a64c1` | fix | 移除 dev-login 端点的 DEBUG 限制，支持生产环境测试账号登录 |
| 07-14 19:32 | `2ac2d28` | docs | 更新后端架构文档，补充 JWT 认证链路说明 |
| 07-14 19:50 | `6691944` | fix | BFF 层所有路由改用用户 JWT 转发认证，移除硬编码 DEV_TOKEN |
| 07-14 20:03 | `5c0082c` | feat | 添加开发环境到生产环境的数据迁移脚本 |
| 07-14 20:12 | `dd7afde` | fix | 迁移脚本 UUID 统一为 32 位 hex 格式，修复 PG 保留关键字 |
| 07-14 22:56 | `d9a8ceb` | fix | 前端健康检查改用 127.0.0.1 避免 IPv6 解析失败 |
| 07-14 23:47 | `9265943` | fix | 前端补齐 hypothesized 项目状态，修复项目列表页客户端异常 |
| 07-14 23:54 | `194d130` | fix | postBlob 补充 getAuthHeader()，修复导出 401 |
| 07-15 00:01 | `4c2ccb4` | fix | report analyze 查询 SimulationConfig 加 order_by+limit(1)，修复 MultipleResultsFound 500 |

**阶段产出**：
- 完成 JWT 认证闭环（前端 → BFF → 后端）
- BFF 层 14 个路由统一鉴权改造，消除硬编码 token
- 数据迁移脚本（dev → prod）正式落地
- 解决国内 Docker 构建 PyPI 拉取失败问题
- 修复 5 个生产环境运行时 bug（IPv6、项目状态、401、500）

---

### 阶段 M3：微信扫码登录 + 邮箱注册 + 路线图（07-15 ~ 07-16）

| 时间 | Hash | 类型 | 说明 |
|------|------|------|------|
| 07-15 10:41 | `b1dc4e2` | feat | S1-1 微信登录接入 + 前端路由守卫 + 开发路线图文档 |
| 07-15 10:50 | `c93e509` | chore | 将 docs/ 目录从 git 追踪中移除，仅本地维护 |
| 07-15 11:05 | `827d5a2` | fix | 登录页 useSearchParams 包裹 Suspense 边界，修复生产构建报错 |
| 07-15 11:48 | `3bcfdef` | feat | 登录页改为二维码弹窗扫码授权（公众号降级方案） |
| 07-15 16:18 | `7770aea` | feat | 新增邮箱注册登录功能（含验证码 + 密码重置） |
| 07-15 23:12 | `c1224a1` | fix | 修复 PostgreSQL 时区比较 bug（datetime.utcnow → datetime.now(timezone.utc)） |
| 07-16 14:23 | `6e38afe` | feat | 暴露 PostgreSQL 5432 端口供外部访问 |

**阶段产出**：
- 完成微信扫码登录（含公众号降级方案）
- 完成邮箱注册 + 验证码 + 密码重置完整链路
- 前端路由守卫 + 开发路线图文档落地
- 修复 PostgreSQL 时区 bug（影响验证码有效期判断）
- docs 目录从 git 移除，避免敏感文档上传

---

### 阶段 M4：问卷模块 R3 验收 + 认证/项目管理 R3 验收（07-18）

| 时间 | Hash | 类型 | 说明 |
|------|------|------|------|
| 07-18 17:14 | `fbb0a82` | feat | auth + project management 模块 R3 accepted |
| 07-18 17:30 | `c573958` | test | 问卷 Round 1 测试 + 测试套件追踪 |
| 07-18 18:04 | `a42874a` | feat | 问卷支持文件上传（.txt / .docx） |
| 07-18 18:09 | `25d9636` | feat | 问卷空状态文案更新 + R3 验收定稿 |

**阶段产出**：
- 认证与项目管理模块通过 R3 验收
- 问卷模块通过 R3 验收，支持文件上传
- 建立测试套件追踪机制

---

### 阶段 M5：用户中心 + 多 LLM 提供商（07-19）

| 时间 | Hash | 类型 | 说明 |
|------|------|------|------|
| 07-19 00:08 | `7997019` | fix | 邮箱验证码哈希存储 + 重置密码 JWT secret 隔离 |
| 07-19 00:09 | `e7cac1d` | feat | 同步支付、前端页面、schema 及剩余测试 |
| 07-19 10:17 | `1d778d1` | feat | 后端 inspect/diagnosis 支持多 LLM 提供商 fallback |
| 07-19 10:18 | `75ae11a` | fix | 防止跳转到已删除项目 + HTTP 下 secure cookie |
| 07-19 11:06 | `aa60738` | fix | 删除项目后跳转至项目列表 |
| 07-19 11:19 | `355dd2a` | fix | 阻止 dialog 点击事件冒泡到项目卡片 |
| 07-19 11:30 | `3f51ccc` | fix | 移除 Google Fonts 构建时依赖 |
| 07-19 11:33 | `2ca1851` | fix | projects-list 重新引入 Link |
| 07-19 11:38 | `c8b00d7` | fix | refresh 路由补充缺失的请求参数 |
| 07-19 11:45 | `7e11dc1` | fix | 后端 Dockerfile PyPI 镜像可配置化 |
| 07-19 15:12 | `5dd5797` | fix | 恢复 initial commit 的营销首页 |
| 07-19 16:27 | `7c17e9e` | fix | 后端默认构建使用阿里云 PyPI 镜像（含超时） |
| 07-19 16:39 | `d595dde` | fix | 允许重新注册未验证邮箱并重发验证码 |
| 07-19 16:50 | `468cb4b` | ui | 注册页添加未验证邮箱重新注册提示 |
| 07-19 17:00 | `c0927a3` | fix | SMTP 发送移入线程池，避免阻塞事件循环 |
| 07-19 17:12 | `0ba1499` | fix | auth 返回 message 放入 data 字段，便于前端读取 |
| 07-19 21:37 | `2dd71de` | fix | BFF 所有路由响应统一包装为 { code, message, data } |
| 07-19 21:43 | `ce7eba2` | feat | 营销首页 header 登录态感知 |
| 07-19 22:11 | `144632e` | feat | 用户中心（昵称/密码/邮箱/头像）+ 营销 header 登录态修复 |
| 07-19 22:19 | `ddd4b8d` | fix | package-lock.json 补充 @radix-ui/react-avatar |
| 07-19 22:24 | `95c669a` | fix | users BFF 路由改用原生 fetch + cookies |
| 07-19 23:21 | `cc97be7` | feat | LLM 模型配置支持数据库动态管理 |

**阶段产出**：
- 用户中心上线（昵称/密码/邮箱/头像 4 项设置）
- 后端多 LLM 提供商 fallback，提升稳定性
- LLM 配置从环境变量升级为数据库动态管理
- 邮箱验证码安全加固（哈希存储 + JWT secret 隔离）
- 支付模块、前端页面、schema 同步落地
- BFF 响应格式统一为 `{ code, message, data }`
- 解决 11 项构建/部署/交互细节 bug

---

### 阶段 M6：免费配额 + 合规框架 + BFF 规范化（07-20）

| 时间 | Hash | 类型 | 说明 |
|------|------|------|------|
| 07-20 08:13 | `1e5be22` | feat | 免费用户周配额实现（按规范） |
| 07-20 08:18 | `0a6aa2b` | fix | quota 字段 limit 重命名为 max_count，避免 PG 保留字 |
| 07-20 08:57 | `9d1ca85` | fix | LLM 重操作 POST 超时提升至 60s |
| 07-20 09:12 | `1dd6ce6` | feat | 周配额接入前端 PaidActionGuard 与 ExportButton |
| 07-20 09:33 | `d0977d0` | fix | 配额耗尽时使用 pointer-events 遮罩拦截点击 |
| 07-20 09:33 | `8a6200f` | chore | 移除 demo.zip 与 error.txt |
| 07-20 10:41 | `59c3ad5` | fix | PaidActionGuard loading 期间跳过配额检查，避免误判 |
| 07-20 17:16 | `771662d` | feat | 完整合规框架实现 F-SYS-005 ~ F-SYS-011 |
| 07-20 20:18 | `8958bd7` | feat | 免费用户周配额从 3 次提升至 6 次 |
| 07-20 20:40 | `0ef6728` | fix | quota API 双重包装导致前端 limit 为 undefined |
| 07-20 20:50 | `d500b61` | fix | BFF 兼容 sample_size / sampleSize 两种字段命名 |
| 07-20 21:22 | `981cf91` | fix | report 404 响应格式修复，前端正确显示生成报告按钮 |
| 07-20 22:01 | `fb66ada` | fix | wechat-url 响应格式统一为 { code, message, data } |
| 07-20 22:32 | `569d1d5` | feat | 微信扫码登录按钮标记为待上线 |
| 07-20 22:34 | `882b169` | feat | 微信扫码按钮点击弹出待上线提示 |

**阶段产出**：
- 免费用户周配额系统上线（模拟/导出/分析 3 类动作，每周 6 次，UTC 周一 00:00 重置）
- 完整合规框架 F-SYS-005 ~ F-SYS-011 落地
- 前端配额拦截（PaidActionGuard + ExportButton + pointer-events 遮罩）
- BFF 响应格式全面规范化
- 微信扫码按钮降级为待上线状态

---

## 三、按模块归类

### 1. 部署与运维
- Docker Compose + Nginx + 双 Dockerfile
- PyPI 镜像可配置化（清华源 → 阿里云默认）
- PostgreSQL 5432 端口外放
- 数据迁移脚本（dev → prod）
- 健康检查 IPv6 修复

### 2. 认证体系
- JWT 认证链路（前端 → BFF → 后端）
- dev-login 端点（生产环境测试账号）
- 微信扫码登录（公众号降级方案，当前标记待上线）
- 邮箱注册 + 验证码（哈希存储）+ 密码重置（独立 JWT secret）
- 前端路由守卫
- BFF 移除硬编码 DEV_TOKEN，统一 JWT 转发

### 3. 项目管理
- 项目 CRUD
- 项目状态机（含 hypothesized 状态补齐）
- 删除项目跳转与已删除项目访问拦截
- 项目概览（project-overview）

### 4. 问卷模块
- 题目表格 + 维度编辑
- 文件上传（.txt / .docx）
- 空状态文案
- R3 验收通过 + 测试套件

### 5. 模拟与报告
- 相关性矩阵 + 假设路径 + 样本量输入
- 报告生成（信度/效度/差异检验/相关/回归）
- 多 LLM 提供商 fallback
- LLM 配置数据库动态管理
- report analyze MultipleResultsFound 500 修复
- 导出 401 修复（postBlob 鉴权头）

### 6. 用户中心
- 昵称 / 密码 / 邮箱 / 头像 4 项设置
- 邮箱更换（双步确认）
- 营销 header 登录态感知

### 7. 支付与配额
- 支付模块（订单/订阅/通知）
- 免费用户周配额（6 次/周，UTC 周一 00:00 重置）
- 配额字段 max_count（规避 PG 保留字）
- 前端配额拦截（PaidActionGuard + ExportButton）

### 8. 合规框架
- F-SYS-005 ~ F-SYS-011 完整实现
- 协议勾选 / 免责声明 / 数据来源确认 / 模拟承诺 / 报告横幅

### 9. 教程系统
- 10 篇教程内容（研究流程/变量类型/信度/KMO/描述统计/相关/差异/回归/写作/统计报告）
- 用户学习进度追踪

### 10. BFF 层规范化
- 所有路由响应统一 `{ code, message, data }`
- 字段命名兼容（sample_size / sampleSize）
- users 路由改用原生 fetch + cookies
- LLM 重操作超时 60s

---

## 四、关键技术决策记录

| 决策 | 背景 | 选择 |
|------|------|------|
| BFF 层鉴权 | 生产环境 401 | 用户 JWT 转发，移除硬编码 DEV_TOKEN |
| 微信登录方案 | 公众号资质限制 | 二维码弹窗扫码 + 待上线降级 |
| 邮箱验证码存储 | 安全合规 | 哈希存储 + 重置密码独立 JWT secret |
| LLM 配置管理 | 多模型切换 | 数据库动态管理 + 多提供商 fallback |
| 免费配额 | 防滥用 | 周配额 6 次，UTC 周一 00:00 重置 |
| docs 目录 | 敏感文档保护 | 从 git 移除，仅本地维护 |
| PyPI 镜像 | 国内构建失败 | 阿里云默认 + 可配置 |
| PostgreSQL 字段 | 保留字冲突 | limit → max_count |

---

## 五、提交类型统计

| 类型 | 次数 | 占比 |
|------|------|------|
| feat | 19 | 38% |
| fix | 25 | 50% |
| chore | 3 | 6% |
| docs | 1 | 2% |
| test | 1 | 2% |
| ui | 1 | 2% |

> 修复类提交占一半，反映出 07-14 ~ 07-20 集中在做生产环境稳定性攻坚与边界 case 收尾。

---

## 六、风险与遗留事项

1. **微信扫码登录**：当前按钮标记为"待上线"，需公众号资质到位后启用真实扫码链路。
2. **dev-login 端点**：已放开 DEBUG 限制以支持生产测试账号，需评估上线前是否恢复限制或加强审计。
3. **PostgreSQL 端口外放**：5432 端口对公开放，需确认防火墙/安全组策略。
4. **免费配额 6 次/周**：已从 3 次提升，需持续观察 LLM 成本与用户活跃度的平衡。
5. **demo.zip / error.txt**：已从仓库移除，但本地仍存在（见 LS 输出），建议加入 .gitignore。

---

## 七、附录：完整提交列表（倒序）

```
882b169  feat(login): 微信扫码按钮点击弹出待上线提示            2026-07-20 22:34
569d1d5  feat(login): 微信扫码登录按钮标记为待上线              2026-07-20 22:32
fb66ada  fix(bff): 修复 wechat-url 响应格式                    2026-07-20 22:01
981cf91  fix(bff): 修复 report 404 响应格式                    2026-07-20 21:22
d500b61  fix(bff): 兼容 sample_size / sampleSize               2026-07-20 20:50
0ef6728  fix(bff): 修复 quota API 双重包装                     2026-07-20 20:40
8958bd7  feat(quota): 免费用户周配额从 3 次提升至 6 次          2026-07-20 20:18
771662d  feat(compliance): 完整合规框架 F-SYS-005~011          2026-07-20 17:16
59c3ad5  fix(paid-action-guard): loading 期间跳过配额检查      2026-07-20 10:41
8a6200f  chore: 移除 demo.zip 和 error.txt                     2026-07-20 09:33
d0977d0  fix(paid-action-guard): pointer-events 遮罩拦截点击   2026-07-20 09:33
1dd6ce6  feat(quota): 周配额接入前端 PaidActionGuard            2026-07-20 09:12
9d1ca85  fix(frontend): LLM 重操作 POST 超时 60s               2026-07-20 08:57
0a6aa2b  fix(quota): limit → max_count 避开 PG 保留字          2026-07-20 08:18
1e5be22  feat(quota): 免费用户周配额实现                        2026-07-20 08:13
cc97be7  feat: LLM 模型配置数据库动态管理                       2026-07-19 23:21
95c669a  fix(bff): users 路由原生 fetch + cookies              2026-07-19 22:24
ddd4b8d  fix: package-lock 补充 @radix-ui/react-avatar         2026-07-19 22:19
144632e  feat: 用户中心（昵称/密码/邮箱/头像）                  2026-07-19 22:11
ce7eba2  feat(marketing): 营销首页 header 登录态感知           2026-07-19 21:43
2dd71de  fix(bff): 所有路由响应统一 { code, message, data }    2026-07-19 21:37
0ba1499  fix(auth): message 放入 data 字段                     2026-07-19 17:12
c0927a3  fix(email): SMTP 发送移入线程池                        2026-07-19 17:00
468cb4b  ui(register): 未验证邮箱重新注册提示                   2026-07-19 16:50
d595dde  fix(auth): 允许重新注册未验证邮箱并重发验证码          2026-07-19 16:39
7c17e9e  fix(deploy): 后端默认阿里云 PyPI 镜像 + 超时           2026-07-19 16:27
5dd5797  fix(web): 恢复 initial commit 的营销首页              2026-07-19 15:12
7e11dc1  fix(deploy): PyPI 镜像可配置化                         2026-07-19 11:45
c8b00d7  fix(web): refresh 路由补充缺失参数                     2026-07-19 11:38
2ca1851  fix(web): projects-list 重新引入 Link                 2026-07-19 11:33
3f51ccc  fix(web): 移除 Google Fonts 构建时依赖                 2026-07-19 11:30
355dd2a  fix(web): 阻止 dialog 点击冒泡到项目卡片               2026-07-19 11:19
aa60738  fix(web): 删除项目后跳转至项目列表                     2026-07-19 11:06
75ae11a  fix(web): 防止跳转已删除项目 + HTTP 下 secure cookie   2026-07-19 10:18
1d778d1  feat(server): inspect/diagnosis 多 LLM fallback       2026-07-19 10:17
e7cac1d  feat: 同步支付、前端页面、schema 及剩余测试            2026-07-19 00:09
7997019  fix(auth): 验证码哈希存储 + 重置 JWT secret 隔离       2026-07-19 00:08
25d9636  feat(questionnaire): 空状态文案 + R3 验收定稿          2026-07-18 18:09
a42874a  feat(questionnaire): 文件上传 .txt/.docx              2026-07-18 18:04
c573958  test(questionnaire): Round 1 测试 + 测试套件追踪      2026-07-18 17:30
fbb0a82  feat: auth + project management 模块 R3 accepted      2026-07-18 17:14
6e38afe  feat: 暴露 PostgreSQL 5432 端口                        2026-07-16 14:23
c1224a1  fix: PostgreSQL 时区比较 bug                           2026-07-15 23:12
7770aea  feat: 邮箱注册登录（验证码 + 密码重置）                2026-07-15 16:18
3bcfdef  feat: 登录页改为二维码弹窗扫码授权（降级方案）         2026-07-15 11:48
827d5a2  fix: 登录页 useSearchParams 包裹 Suspense             2026-07-15 11:05
c93e509  chore: docs/ 目录从 git 追踪中移除                     2026-07-15 10:50
b1dc4e2  feat: S1-1 微信登录 + 路由守卫 + 路线图文档            2026-07-15 10:41
4c2ccb4  fix: report analyze MultipleResultsFound 500           2026-07-15 00:01
194d130  fix: postBlob 补充 getAuthHeader() 修复导出 401        2026-07-14 23:54
9265943  fix: 前端补齐 hypothesized 项目状态                    2026-07-14 23:47
d9a8ceb  fix: 健康检查改用 127.0.0.1 避免 IPv6 失败             2026-07-14 22:56
dd7afde  fix: 迁移脚本 UUID 32 位 hex + PG 保留字               2026-07-14 20:12
5c0082c  feat: 添加 dev → prod 数据迁移脚本                     2026-07-14 20:03
6691944  fix: BFF 所有路由改用 JWT 转发，移除 DEV_TOKEN         2026-07-14 19:50
2ac2d28  docs: 更新后端架构文档，补充 JWT 认证链路              2026-07-14 19:32
e7a64c1  fix: 移除 dev-login 的 DEBUG 限制                      2026-07-14 19:27
90dd197  fix: Dockerfile 清华镜像源解决 PyPI 拉取               2026-07-14 19:15
b020cfa  feat: 完整 JWT 认证链路（dev-login + apiClient）       2026-07-14 15:45
5b987fa  fix: Nginx 配置统一走 Next.js BFF 层                   2026-07-14 08:23
38769b5  fix: Docker 构建 public 目录不存在                     2026-07-13 21:12
d480115  fix: TypeScript 类型错误 cells.length undefined        2026-07-13 21:06
f17e63c  fix: ESLint 引号转义错误                                2026-07-13 21:02
47bdefa  fix: Docker 构建安装完整依赖（含 devDependencies）     2026-07-13 20:26
044a489  feat: 初始化项目并添加 Docker 部署配置（210 文件）     2026-07-13 17:27
37019ca  Initial commit（LICENSE）                              2026-07-01 14:37
```
