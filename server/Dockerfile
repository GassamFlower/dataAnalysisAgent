# 后端 Dockerfile - 数据分析 Agent FastAPI 服务
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 升级 pip
RUN pip install --upgrade pip

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖（默认使用 PyPI；国内环境可通过 docker build --build-arg PIP_INDEX_URL=... 指定镜像）
ARG PIP_INDEX_URL
ARG PIP_TRUSTED_HOST
RUN pip install --no-cache-dir -r requirements.txt ${PIP_INDEX_URL:+-i $PIP_INDEX_URL} ${PIP_TRUSTED_HOST:+--trusted-host $PIP_TRUSTED_HOST}

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
