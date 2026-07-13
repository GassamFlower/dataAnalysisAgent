# 数据分析智能体后端

问卷研究预演工具后端服务（Python FastAPI）

## 技术栈

- **语言**: Python 3.11+
- **框架**: FastAPI 0.110+
- **数据库**: PostgreSQL 15+
- **ORM**: SQLAlchemy 2.0（异步）
- **迁移**: Alembic 1.13+

## 目录结构

```
server/
├── app/
│   ├── api/v1/          # 路由层
│   ├── core/            # 核心模块（配置、日志、异常、数据库、依赖）
│   ├── models/          # 数据库模型
│   ├── schemas/         # Pydantic 模型
│   ├── services/        # 业务逻辑
│   ├── utils/           # 工具函数
│   └── main.py          # 应用入口
├── migrations/          # Alembic 迁移
├── tests/               # 测试
└── requirements.txt     # 依赖
```

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 开发依赖（测试、代码质量）
pip install -r requirements-dev.txt
```

### 2. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env，配置：
# - DEEPSEEK_API_KEY: DeepSeek API 密钥
# - DATABASE_URL: PostgreSQL 连接字符串
```

### 3. 数据库初始化

```bash
# 确保 PostgreSQL 运行
# 创建数据库
createdb data_analysis_agent

# 运行迁移（首次）
alembic upgrade head

# 或自动生成迁移
alembic revision --autogenerate -m "init"
alembic upgrade head
```

### 4. 启动服务

```bash
# 开发模式（热重载）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 5. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

## 测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_health.py

# 带覆盖率
pytest --cov=app --cov-report=html
```

## 代码质量

```bash
# 代码检查
ruff check app/

# 自动修复
ruff check --fix app/

# 格式化
ruff format app/

# 类型检查
mypy app/
```

## 数据库迁移

```bash
# 生成迁移脚本
alembic revision --autogenerate -m "描述"

# 应用迁移
alembic upgrade head

# 回滚一个版本
alembic downgrade -1

# 查看迁移历史
alembic history
```

## 开发规范

详见 [后端架构设计文档](../后端架构设计文档.md)

### 关键规范

1. **异步优先**: I/O 操作必须用 `async def`
2. **依赖注入**: 使用 `Depends()` 管理数据库连接、认证
3. **统一响应**: 所有接口返回 `{code, message, data}` 格式
4. **错误处理**: 自定义异常 + 全局处理器
5. **日志规范**: 使用 `logging`，禁止 `print()`
6. **类型提示**: 强制 type hints

### 新增模块

1. 路由: `app/api/v1/xxx.py`
2. Schema: `app/schemas/xxx.py`
3. Service: `app/services/xxx.py`
4. Model: `app/models/xxx.py`（如需新表）
5. 在 `app/api/v1/__init__.py` 注册路由

## 架构文档

- [后端架构设计文档](../后端架构设计文档.md)
- [Agent宪法](../Agent宪法.md)
- [立项文档](../立项文档.md)
- [数据库schema设计](../数据库schema设计.md)
