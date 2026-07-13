# 部署指南 - 数据分析 Agent

## 环境要求

- Ubuntu 20.04 / 22.04
- 2核 4G 内存
- 20GB 磁盘
- 公网 IP

## 架构

```
用户浏览器 → Nginx(80) → 前端 Next.js(3000) → BFF 转发 → 后端 FastAPI(8000) → PostgreSQL(5432)
```

所有服务在 Docker 内网通信，仅 Nginx 暴露 80 端口。

---

## 快速部署（3步）

### 步骤 1: 上传项目

将项目上传到服务器（推荐 `/opt/dataAnalysisAgent`）：

```bash
# 方式 A：Git 克隆
git clone <仓库地址> /opt/dataAnalysisAgent
cd /opt/dataAnalysisAgent

# 方式 B：scp 上传
scp -r dataAnalysisAgent/ root@你的IP:/opt/
```

### 步骤 2: 运行部署脚本

```bash
cd /opt/dataAnalysisAgent
sudo bash deploy/deploy.sh
```

脚本会自动完成：
- 安装 Docker + Docker Compose
- 配置防火墙（UFW）
- 安装 Fail2ban 防暴力破解
- 生成 JWT 密钥 + 数据库密码
- 生成 .env 配置文件

脚本会提示你配置 DeepSeek API Key。

### 步骤 3: 配置 API Key 并启动

```bash
# 编辑后端配置
nano server/.env.production
# 修改 DEEPSEEK_API_KEY=sk-你的密钥

# 启动服务
sudo bash deploy/deploy.sh --start
```

完成后浏览器访问 `http://你的服务器IP`。

---

## 文件结构

```
dataAnalysisAgent/
├── docker-compose.yml        # 容器编排（4个服务）
├── .env                      # 数据库密码（自动生成）
├── server/
│   ├── Dockerfile
│   └── .env.production        # 后端配置
├── web/
│   ├── Dockerfile
│   └── .env.production        # 前端配置
├── nginx/
│   ├── nginx.conf             # Nginx 主配置
│   └── conf.d/default.conf    # 反向代理 + 限流
└── deploy/
    ├── deploy.sh              # 一键部署脚本
    └── DEPLOY_GUIDE.md        # 本文档
```

---

## 安全措施

| 措施 | 状态 | 说明 |
|------|------|------|
| 防火墙 (UFW) | ✅ | 仅开放 SSH + 80 端口 |
| Fail2ban | ✅ | SSH 3次失败封禁1小时 |
| Nginx 限流 | ✅ | API 10r/s，登录 1r/s |
| 安全 HTTP 头 | ✅ | X-Frame-Options 等 |
| Docker 隔离 | ✅ | 数据库不暴露外网 |
| 非 root 运行 | ✅ | 容器内非特权用户 |
| 自动安全更新 | ✅ | unattended-upgrades |
| 隐藏 Nginx 版本 | ✅ | server_tokens off |

---

## 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看实时日志
docker compose logs -f
docker compose logs -f backend    # 仅后端
docker compose logs -f nginx      # 仅 Nginx

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新代码后重新部署
git pull
docker compose up -d --build

# 进入容器调试
docker exec -it daa-backend bash
docker exec -it daa-frontend sh

# 数据库操作
docker exec -it daa-db psql -U postgres -d data_analysis_agent

# 备份数据库
docker exec daa-db pg_dump -U postgres data_analysis_agent > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup.sql | docker exec -i daa-db psql -U postgres -d data_analysis_agent
```

---

## 故障排查

### 容器启动失败

```bash
# 查看错误日志
docker compose logs backend
docker compose logs frontend

# 检查配置
cat server/.env.production
cat .env
```

### 80 端口被占用

```bash
# 查看占用
sudo lsof -i :80

# 停止占用服务（如 Apache）
sudo systemctl stop apache2
sudo systemctl disable apache2
```

### 数据库连接失败

```bash
# 检查数据库容器
docker compose ps db
docker compose logs db

# 确认密码一致
grep DB_PASSWORD .env
cat docker-compose.yml | grep DB_PASSWORD
```

### 前端 502

```bash
# 检查前端是否启动
docker compose logs frontend

# 重新构建前端
docker compose up -d --build frontend
```

---

## 后期升级到 HTTPS

购买域名后，修改 Nginx 配置添加 SSL：

```bash
# 1. 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 2. 申请证书（替换 yourdomain.com）
sudo certbot --nginx -d yourdomain.com

# 3. 修改后端 FRONTEND_URL
nano server/.env.production
# FRONTEND_URL=https://yourdomain.com

# 4. 重启
docker compose restart backend
```

---

## 定期备份

```bash
# 添加定时任务
crontab -e

# 每天凌晨 2 点备份数据库
0 2 * * * docker exec daa-db pg_dump -U postgres data_analysis_agent > /opt/backup/db_$(date +\%Y\%m\%d).sql

# 保留最近 7 天备份
0 3 * * * find /opt/backup -name "db_*.sql" -mtime +7 -delete
```
