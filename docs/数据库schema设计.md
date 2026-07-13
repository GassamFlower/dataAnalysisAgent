# 数据库设计文件

> 本文件是数据库设计的唯一基线，所有表结构、字段、关联关系必须与此文件一致。
> 任何数据库变更必须先修改本文件，再同步 SQLAlchemy 模型，最后执行 migration。
> **技术栈（2026-07-10 修宪同步）**：ORM 为 SQLAlchemy 2.0（async），开发环境用 SQLite（WAL 模式），生产环境用 PostgreSQL 15+。模型定义在 `server/app/models/`，迁移工具为 Alembic。
> 关联文档：[Agent宪法](./Agent宪法.md) 第 21-A~21-D 条

---

## 一、设计原则

### 1.1 范式要求

遵循前三范式：
- **第一范式（1NF）**：字段原子性，不可再分
- **第二范式（2NF）**：消除部分依赖，非主键字段完全依赖主键
- **第三范式（3NF）**：消除传递依赖，非主键字段不依赖其他非主键字段

### 1.2 反范式设计（冗余字段）

以下字段为反范式设计，用于提升查询性能：

| 表 | 字段 | 冗余来源 | 原因 | 同步策略 |
|---|---|---|---|---|
| `reports` | `overall_alpha` | 从 `reliability_results` 计算 | 项目列表需要展示平均 α，避免每次 JOIN 计算 | 应用层双写：生成报告时同步写入 |
| `reports` | `passed_count` | 从 `reliability_results` 统计 | 同上 | 同上 |
| `reports` | `total_count` | 从 `reliability_results` 统计 | 同上 | 同上 |
| `projects` | `status` | 从业务流程推导 | 项目列表需要按状态筛选，避免复杂查询 | 应用层状态机：流程节点完成时更新 |

### 1.3 命名规范

- 表名：小写复数（`users`, `projects`, `questions`）
- 字段名：小写下划线（`user_id`, `created_at`）
- 主键：`id UUID PRIMARY KEY`
- 外键：`{关联表单数}_id`（`user_id`, `project_id`）
- 时间戳：`created_at`, `updated_at`（UTC 时区）

---

## 二、核心业务对象

### 2.1 对象清单

| 对象 | 表名 | 说明 |
|---|---|---|
| 用户 | `users` | 微信登录用户 |
| 项目 | `projects` | 问卷研究预演项目 |
| 题目 | `questions` | 问卷题目（体检后生成） |
| 假设 | `hypotheses` | 用户一句话假设 |
| 假设路径 | `hypothesis_paths` | LLM 解析的主效应路径 |
| 相关矩阵 | `correlation_matrices` | 维度间相关系数矩阵 |
| 模拟配置 | `simulation_configs` | 数据生成参数 |
| 数据集 | `datasets` | 生成的模拟数据集（JSON 存储） |
| 报告 | `reports` | 统计报告 |
| 信效度结果 | `reliability_results` | 各维度 α/KMO/Bartlett |
| 诊断 | `diagnoses` | R4 诊断结论 |
| 诊断问题 | `diagnosis_issues` | 不达标项明细 |
| 订单 | `orders` | 支付订单 |

### 2.2 对象关系图

```
users (1) ──────< (N) projects
                    │
                    ├──< (N) questions
                    │
                    ├──< (N) hypotheses
                    │       │
                    │       └──< (N) hypothesis_paths
                    │
                    ├──< (N) correlation_matrices
                    │
                    ├──< (N) simulation_configs
                    │       │
                    │       └──< (1) datasets
                    │
                    └──< (N) reports
                            │
                            ├──< (N) reliability_results
                            │
                            └──< (1) diagnoses
                                    │
                                    └──< (N) diagnosis_issues

users (1) ──────< (N) orders ──────> (1) projects (可选)
```

---

## 三、表结构定义

### 3.1 users（用户表）

**业务对象**：微信登录用户

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 用户 ID |
| `openid` | VARCHAR(64) | UNIQUE NOT NULL | 微信 openid |
| `nickname` | VARCHAR(100) | | 昵称 |
| `avatar` | VARCHAR(500) | | 头像 URL |
| `plan` | VARCHAR(20) | DEFAULT 'free' | 套餐：free/single/subscription |
| `plan_expires_at` | TIMESTAMP | | 套餐过期时间（免费用户为空） |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**索引**：
- `idx_users_openid`：`openid`（唯一索引）

**关联**：
- 1:N → `projects`（一个用户多个项目）
- 1:N → `orders`（一个用户多个订单）

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

### 3.2 projects（项目表）

**业务对象**：问卷研究预演项目

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 项目 ID |
| `user_id` | UUID | NOT NULL, FK → users.id | 所属用户 |
| `name` | VARCHAR(200) | NOT NULL | 项目名称 |
| `status` | VARCHAR(20) | DEFAULT 'draft' | 状态：draft/inspected/simulated/reported |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**索引**：
- `idx_projects_user_id`：`user_id`
- `idx_projects_status`：`status`

**关联**：
- N:1 → `users`
- 1:N → `questions`
- 1:N → `hypotheses`
- 1:N → `correlation_matrices`
- 1:N → `simulation_configs`
- 1:N → `reports`

**状态流转**：
```
draft → inspected → simulated → reported
  ↑         ↑           ↑           ↑
新建项目  体检完成    生成完成    报告完成
```

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：`status` 是从业务流程推导的冗余字段（反范式），理由：项目列表需要按状态筛选，避免复杂查询。同步策略：应用层状态机，流程节点完成时更新。

---

### 3.3 questions（题目表）

**业务对象**：问卷题目（体检后生成）

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 题目 ID |
| `project_id` | UUID | NOT NULL, FK → projects.id | 所属项目 |
| `index` | INT | NOT NULL | 题号 |
| `text` | TEXT | NOT NULL | 题干 |
| `question_type` | VARCHAR(20) | NOT NULL | 题型：likert5/likert7/demographic/other |
| `dimension` | VARCHAR(100) | NOT NULL | 维度名称 |
| `is_reverse` | BOOLEAN | DEFAULT FALSE | 是否反向题 |
| `confidence` | VARCHAR(10) | DEFAULT 'high' | 维度归属置信度：high/low |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引**：
- `idx_questions_project_id`：`project_id`

**关联**：
- N:1 → `projects`

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：`dimension` 是 LLM 推断的结果，不是外键关联的维度表，因为维度是动态生成的，不需要单独表 ✓

---

### 3.4 hypotheses（假设表）

**业务对象**：用户一句话假设

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 假设 ID |
| `project_id` | UUID | NOT NULL, FK → projects.id | 所属项目 |
| `raw_text` | TEXT | NOT NULL | 用户原始假设文本 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引**：
- `idx_hypotheses_project_id`：`project_id`

**关联**：
- N:1 → `projects`
- 1:N → `hypothesis_paths`

**设计说明**：
- 一个项目可能有多次假设尝试，所以是 1:N 关系
- `parsed_paths` 不存储在此表，而是拆成 `hypothesis_paths` 表，便于用户编辑

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

### 3.5 hypothesis_paths（假设路径表）

**业务对象**：LLM 解析的主效应路径

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 路径 ID |
| `hypothesis_id` | UUID | NOT NULL, FK → hypotheses.id | 所属假设 |
| `predictor` | VARCHAR(100) | NOT NULL | 自变量维度 |
| `outcome` | VARCHAR(100) | NOT NULL | 因变量维度 |
| `direction` | VARCHAR(10) | NOT NULL | 方向：positive/negative |
| `strength` | VARCHAR(10) | NOT NULL | 强度：weak/medium/strong |

**索引**：
- `idx_hypothesis_paths_hypothesis_id`：`hypothesis_id`

**关联**：
- N:1 → `hypotheses`

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

### 3.6 correlation_matrices（相关矩阵表）

**业务对象**：维度间相关系数矩阵

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 矩阵 ID |
| `project_id` | UUID | NOT NULL, FK → projects.id | 所属项目 |
| `dimensions` | JSONB | NOT NULL | 维度列表，如 `["学习动机", "自我效能感"]` |
| `cells` | JSONB | NOT NULL | 矩阵单元格二维数组 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**索引**：
- `idx_correlation_matrices_project_id`：`project_id`

**关联**：
- N:1 → `projects`

**JSONB 结构说明**：

`dimensions` 示例：
```json
["学习动机", "自我效能感", "学业表现"]
```

`cells` 示例（3x3 矩阵）：
```json
[
  [
    {"value": 1.0, "source": "system"},
    {"value": 0.42, "source": "system"},
    {"value": 0.6, "source": "user"}
  ],
  [
    {"value": 0.42, "source": "system"},
    {"value": 1.0, "source": "system"},
    {"value": 0.45, "source": "user"}
  ],
  [
    {"value": 0.6, "source": "user"},
    {"value": 0.45, "source": "user"},
    {"value": 1.0, "source": "system"}
  ]
]
```

**设计说明**：
- 使用 JSONB 而非拆表，因为矩阵大小不固定，且主要用于展示，不需要细粒度查询
- 一个项目可能有多次矩阵调整，所以是 1:N 关系

**范式检查**：
- 1NF：JSONB 是原子类型（PostgreSQL 支持）✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

### 3.7 simulation_configs（模拟配置表）

**业务对象**：数据生成参数

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 配置 ID |
| `project_id` | UUID | NOT NULL, FK → projects.id | 所属项目 |
| `sample_size` | INT | NOT NULL | 样本量 |
| `hypothesis_id` | UUID | FK → hypotheses.id | 关联假设 |
| `matrix_id` | UUID | FK → correlation_matrices.id | 关联矩阵 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引**：
- `idx_simulation_configs_project_id`：`project_id`

**关联**：
- N:1 → `projects`
- N:1 → `hypotheses`（可选）
- N:1 → `correlation_matrices`（可选）

**设计说明**：
- 记录每次生成的配置，便于回溯
- 一个项目可能有多次生成，所以是 1:N 关系

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

### 3.8 datasets（数据集表）

**业务对象**：生成的模拟数据集

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 数据集 ID |
| `simulation_config_id` | UUID | NOT NULL, FK → simulation_configs.id, UNIQUE | 所属模拟配置（1:1） |
| `project_id` | UUID | NOT NULL, FK → projects.id | 所属项目（冗余） |
| `sample_size` | INT | NOT NULL | 样本量（冗余） |
| `columns` | JSONB | NOT NULL | 列名列表，如 `["q1","q2",...]` |
| `data` | JSONB | NOT NULL | 数据行（records 格式 `[{...},{...}]`） |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引**：
- `idx_datasets_simulation_config_id`：`simulation_config_id`（唯一索引）
- `idx_datasets_project_id`：`project_id`

**关联**：
- 1:1 → `simulation_configs`
- N:1 → `projects`

**反范式设计**：
- `project_id`：冗余自 `simulation_configs`，理由：报告生成时按项目直接查最新数据集，避免 JOIN。同步策略：随 `simulation_configs` 一同写入。
- `sample_size`：冗余自 `simulation_configs`，理由：展示时直接读取，避免 JOIN。同步策略：同上。

**JSONB 结构说明**：

`columns` 示例：
```json
["q1", "q2", "q3", "q4", "q5"]
```

`data` 示例（records 格式，每行一个对象）：
```json
[
  {"q1": 4, "q2": 3, "q3": 5, "q4": 2, "q5": 4},
  {"q1": 3, "q2": 4, "q3": 3, "q4": 3, "q5": 5}
]
```

**设计说明**：
- 使用 JSONB 存储 DataFrame，因为列数不固定且主要用于读取计算，无需细粒度查询
- `simulation_config_id` UNIQUE 约束：一个配置只对应一个数据集（1:1）
- 一个项目可能多次调参重试，所以项目下有多个数据集，取最新者用于报告

**范式检查**：
- 1NF：JSONB 是原子类型（PostgreSQL 支持）✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：`project_id`/`sample_size` 是冗余字段（反范式），理由和同步策略见上

---

### 3.9 reports（报告表）

**业务对象**：统计报告

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 报告 ID |
| `project_id` | UUID | NOT NULL, FK → projects.id | 所属项目 |
| `overall_alpha` | DECIMAL(4,3) | | 平均 α（反范式） |
| `passed_count` | INT | | 达标维度数（反范式） |
| `total_count` | INT | | 总维度数（反范式） |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引**：
- `idx_reports_project_id`：`project_id`

**关联**：
- N:1 → `projects`
- 1:N → `reliability_results`
- 1:1 → `diagnoses`

**反范式设计**：
- `overall_alpha`：从 `reliability_results` 计算，理由：项目列表需要展示，避免每次 JOIN
- `passed_count`：从 `reliability_results` 统计，理由：同上
- `total_count`：从 `reliability_results` 统计，理由：同上
- 同步策略：应用层双写，生成报告时同步写入

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：`overall_alpha`/`passed_count`/`total_count` 是冗余字段（反范式），理由和同步策略见上

---

### 3.10 reliability_results（信效度结果表）

**业务对象**：各维度信效度结果

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 结果 ID |
| `report_id` | UUID | NOT NULL, FK → reports.id | 所属报告 |
| `dimension` | VARCHAR(100) | NOT NULL | 维度名称 |
| `alpha` | DECIMAL(4,3) | NOT NULL | Cronbach's α |
| `kmo` | DECIMAL(4,3) | NOT NULL | KMO 值 |
| `bartlett_p_value` | DECIMAL(6,5) | NOT NULL | Bartlett 球形检验 p 值 |
| `passed` | BOOLEAN | NOT NULL | 是否达标 |

**索引**：
- `idx_reliability_results_report_id`：`report_id`

**关联**：
- N:1 → `reports`

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

### 3.11 diagnoses（诊断表）

**业务对象**：R4 诊断结论

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 诊断 ID |
| `report_id` | UUID | NOT NULL, FK → reports.id, UNIQUE | 所属报告（1:1） |
| `passed` | BOOLEAN | NOT NULL | 整体是否达标 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引**：
- `idx_diagnoses_report_id`：`report_id`（唯一索引）

**关联**：
- 1:1 → `reports`
- 1:N → `diagnosis_issues`

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

### 3.11 diagnosis_issues（诊断问题表）

**业务对象**：不达标项明细

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 问题 ID |
| `diagnosis_id` | UUID | NOT NULL, FK → diagnoses.id | 所属诊断 |
| `dimension` | VARCHAR(100) | NOT NULL | 维度名称 |
| `metric` | VARCHAR(50) | NOT NULL | 指标：Cronbach's α / KMO 等 |
| `value` | DECIMAL(6,4) | NOT NULL | 实际值 |
| `threshold` | DECIMAL(6,4) | NOT NULL | 阈值 |
| `reason` | TEXT | NOT NULL | 原因 |
| `suggestion` | TEXT | NOT NULL | 修改建议 |

**索引**：
- `idx_diagnosis_issues_diagnosis_id`：`diagnosis_id`

**关联**：
- N:1 → `diagnoses`

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

### 3.13 orders（订单表）

**业务对象**：支付订单

**字段定义**：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | 订单 ID |
| `user_id` | UUID | NOT NULL, FK → users.id | 所属用户 |
| `project_id` | UUID | FK → projects.id | 关联项目（订阅订单为空） |
| `type` | VARCHAR(20) | NOT NULL | 类型：single/subscription |
| `amount` | DECIMAL(10,2) | NOT NULL | 金额 |
| `status` | VARCHAR(20) | DEFAULT 'pending' | 状态：pending/paid/refunded |
| `paid_at` | TIMESTAMP | | 支付时间 |
| `expires_at` | TIMESTAMP | | 过期时间（订阅订单） |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引**：
- `idx_orders_user_id`：`user_id`
- `idx_orders_project_id`：`project_id`
- `idx_orders_status`：`status`

**关联**：
- N:1 → `users`
- N:1 → `projects`（可选）

**设计说明**：
- 单次报告：`project_id` 必填
- 月度订阅：`project_id` 为空，`users.plan` 更新为 'subscription'

**范式检查**：
- 1NF：所有字段原子性 ✓
- 2NF：非主键完全依赖 `id` ✓
- 3NF：无传递依赖 ✓

---

## 四、数据流转示例

### 4.1 新建项目流程

```
1. 用户创建项目
   → INSERT INTO projects (user_id, name, status='draft')

2. 用户上传题目
   → INSERT INTO questions (project_id, index, text, ...)

3. 系统体检（LLM 解析）
   → UPDATE questions SET question_type, dimension, is_reverse, confidence
   → UPDATE projects SET status='inspected'
```

### 4.2 数据生成流程

```
1. 用户输入假设
   → INSERT INTO hypotheses (project_id, raw_text)
   → INSERT INTO hypothesis_paths (hypothesis_id, predictor, outcome, direction, strength)

2. 系统补全矩阵
   → INSERT INTO correlation_matrices (project_id, dimensions, cells)

3. 用户确认生成
   → INSERT INTO simulation_configs (project_id, sample_size, hypothesis_id, matrix_id)
   → INSERT INTO datasets (simulation_config_id, project_id, sample_size, columns, data)
   → UPDATE projects SET status='simulated'
```

### 4.3 报告生成流程

```
1. 读取最新数据集
   → SELECT data, columns FROM datasets WHERE project_id = ... ORDER BY created_at DESC LIMIT 1

2. 系统计算信效度
   → INSERT INTO reports (project_id)
   → INSERT INTO reliability_results (report_id, dimension, alpha, kmo, bartlett_p_value, passed)

3. R4 诊断
   → INSERT INTO diagnoses (report_id, passed)
   → INSERT INTO diagnosis_issues (diagnosis_id, dimension, metric, value, threshold, reason, suggestion)

4. 更新报告汇总（反范式同步）
   → UPDATE reports SET overall_alpha, passed_count, total_count
   → UPDATE projects SET status='reported'
```

---

## 五-A、不落库计算字段模式（2026-07-10 新增）

以下字段不存储在数据库中，而是在 API 响应时实时计算并注入：

| 字段 | 所属表 | 计算来源 | 注入端点 |
|------|--------|---------|---------|
| diff_tests | Report | HypothesisPath + Dataset（差异检验决策树 9.6） | report/analyze、report/get |
| sample_size | Report | SimulationConfig.sample_size | report/analyze、report/get |
| alpha_grade / kmo_grade / bartlett_grade | ReliabilityResult | statistics_constants 分档表 | report/analyze |
| alpha_wording / kmo_wording / bartlett_wording | ReliabilityResult | statistics_constants 措辞表 | report/analyze |

**设计原则**：
- 依赖外部数据（如 Dataset + HypothesisPath）且不需要持久化的计算结果，不建表
- 统计分档标准集中在 `app/core/statistics_constants.py`，禁止在 stats.py/diagnoser.py 或 LLM prompt 中硬编码阈值
- analyze 和 get_report 端点都需调用同一计算函数保证响应一致

**注入模式**：
ORM 查询后 `ResponseModel.model_validate(orm_obj)` 构造响应对象 → 手动设置计算字段 → 返回 `ResponseModel(data=response)`。

---

## 五、待确认问题

1. **是否需要 `audit_logs` 表记录操作日志**？（当前方案：不需要，MVP 阶段）
2. **是否需要 `files` 表存储上传的题目文档**？（当前方案：不需要，题目直接存 `questions` 表）
3. **订单是否需要关联微信支付的 `transaction_id`**？（当前方案：需要，但 MVP 阶段可后补）

---

## 六、变更记录

| 日期 | 变更内容 | 变更人 |
|---|---|---|
| 2026-06-30 | 初始版本 | - |
| 2026-07-09 | 新增 datasets 表（3.8），持久化 generator 产出的模拟数据；顺延 3.9~3.13 编号；更新 4.2/4.3 数据流转 | - |
| 2026-07-10 | 技术栈同步 | Prisma→SQLAlchemy 2.0；PostgreSQL→SQLite(开发)/PostgreSQL(生产)；新增不落库计算字段模式章节 | 修宪第 21 条同步 |

---

**本设计文件自发布之日起生效。任何字段变更必须先修改本文件，再同步 SQLAlchemy 模型，最后执行 Alembic migration。**
