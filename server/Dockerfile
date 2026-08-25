# 后端 Dockerfile - 数据分析 Agent FastAPI 服务
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# PyPI 镜像（默认阿里云，可通过 build-arg 覆盖；升级 pip 与依赖安装统一走它）
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple
ARG PIP_TRUSTED_HOST=mirrors.aliyun.com

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 升级 pip（走镜像 + 超时重试，避免 files.pythonhosted.org 网络超时）
RUN pip install --no-cache-dir --timeout 120 --retries 5 --upgrade pip \
    --index-url $PIP_INDEX_URL --trusted-host $PIP_TRUSTED_HOST

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖（同镜像 + 超时重试）
RUN pip install --no-cache-dir --timeout 120 --retries 5 -r requirements.txt \
    --index-url $PIP_INDEX_URL --trusted-host $PIP_TRUSTED_HOST

# 复制应用代码
COPY . .

# 创建非 root 用户
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
