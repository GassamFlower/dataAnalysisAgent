#!/bin/bash
# ============================================================
# 统计小课堂 - 服务器一键初始化脚本
# 适用环境：Ubuntu 22.04/24.04，2核2G，无域名（IP 直接访问）
# 用法：sudo bash init-server.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

# === 前置检查 ===
[ "$(id -u)" -ne 0 ] && err "请用 sudo 运行此脚本"

echo ""
echo "=========================================="
echo "  统计小课堂 - 服务器初始化"
echo "=========================================="
echo ""

# === Step 1: 系统更新 ===
info "Step 1/8: 系统更新..."
apt update -qq
apt upgrade -y -qq
apt install -y -qq curl wget git vim ufw fail2ban unzip jq \
  software-properties-common ca-certificates gnupg lsb-release
log "系统更新完成"

# === Step 1.5: 配置 Swap（2G 内存必须）===
if [ ! -f /swapfile ]; then
  info "配置 2GB Swap（2G 内存需要）..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # 优化 swap 参数
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  log "Swap 已配置（2GB，swappiness=10）"
else
  log "Swap 已存在: $(free -h | grep Swap | awk '{print $2}')"
fi

# === Step 2: 安装 Docker ===
if command -v docker &>/dev/null; then
  log "Docker 已安装: $(docker --version)"
else
  info "Step 2/8: 安装 Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt update -qq
  apt install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  # 把 ubuntu 用户加入 docker 组
  usermod -aG docker ubuntu 2>/dev/null || true
  log "Docker 安装完成: $(docker --version)"
fi

# 确认 docker compose 可用
if docker compose version &>/dev/null; then
  log "Docker Compose 可用: $(docker compose version --short)"
else
  err "Docker Compose 不可用，请检查安装"
fi

# === Step 3: 安全加固 ===
info "Step 3/8: 安全加固..."

# UFW 防火墙
ufw --force reset >/dev/null 2>&1
ufw default deny incoming >/dev/null 2>&1
ufw default allow outgoing >/dev/null 2>&1
ufw allow ssh >/dev/null 2>&1
ufw allow 80/tcp >/dev/null 2>&1
ufw allow 443/tcp >/dev/null 2>&1
ufw --force enable >/dev/null 2>&1
log "防火墙已配置（开放 22/80/443）"

# Fail2ban
cat > /etc/fail2ban/jail.local << 'F2B'
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1
bantime  = 3600
findtime = 600
maxretry = 3

[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 3600

[nginx-botsearch]
enabled  = true
port     = http,https
filter   = nginx-botsearch
logpath  = /var/log/nginx/access.log
maxretry = 10
bantime  = 86400
F2B
systemctl enable fail2ban
systemctl restart fail2ban
log "Fail2ban 已配置"

# 自动安全更新
apt install -y -qq unattended-upgrades 2>/dev/null || true
log "安全加固完成"

# === Step 4: 生成密钥 ===
info "Step 4/8: 生成安全密钥..."

JWT_SECRET=$(openssl rand -base64 48)
RESET_JWT_SECRET=$(openssl rand -base64 48)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | head -c 32)
CALLBACK_TOKEN=$(openssl rand -base64 32)

log "密钥已生成"

# === Step 5: 创建项目目录 ===
info "Step 5/8: 准备项目目录..."

APP_DIR="/opt/dataAnalysisAgent"
mkdir -p "$APP_DIR"
mkdir -p /opt/backups/postgres
mkdir -p "$APP_DIR/nginx/ssl"
mkdir -p "$APP_DIR/nginx/html"
mkdir -p "$APP_DIR/server/certs"

log "目录已创建"

# === Step 6: 克隆代码 ===
if [ -d "$APP_DIR/.git" ]; then
  log "代码已存在，跳过克隆"
else
  info "Step 6/8: 克隆代码..."
  echo ""
  warn "请输入你的 Git 仓库地址（私有仓库需要认证）："
  warn "如果你已经手动上传了代码，按 Enter 跳过"
  echo ""
  read -p "Git 仓库地址（留空跳过）: " GIT_URL
  if [ -n "$GIT_URL" ]; then
    git clone "$GIT_URL" "$APP_DIR" || warn "克隆失败，请手动上传代码到 $APP_DIR"
  else
    warn "跳过克隆，请确保代码已在 $APP_DIR"
  fi
fi

# === Step 7: 配置环境变量 ===
info "Step 7/8: 配置环境变量..."

# 获取服务器公网 IP
SERVER_IP=$(curl -sf --connect-timeout 5 http://ifconfig.me 2>/dev/null || echo "你的服务器IP")

# --- 后端 .env.production ---
cat > "$APP_DIR/server/.env.production" << ENVBACKEND
# === 环境 ===
DEBUG=false
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000

# === 数据库 ===
DATABASE_URL=postgresql+asyncpg://postgres:${DB_PASSWORD}@db:5432/data_analysis_agent

# === JWT（双密钥隔离）===
JWT_SECRET_KEY=${JWT_SECRET}
RESET_JWT_SECRET_KEY=${RESET_JWT_SECRET}
JWT_EXPIRE_MINUTES=15
JWT_REFRESH_EXPIRE_MINUTES=10080

# === 开发后门（关闭）===
ALLOW_DEV_TOKEN=false

# === 前端地址 ===
FRONTEND_URL=http://${SERVER_IP}

# === LLM ===
DEEPSEEK_API_KEY=
KIMI_API_KEY=
QWEN_API_KEY=

# === 微信登录（待配置）===
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_REDIRECT_URI=http://${SERVER_IP}/api/v1/auth/wechat/callback

# === SMTP 邮箱（待配置）===
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=统计小课堂

# === 支付（待配置）===
ENABLE_ONLINE_PAYMENT=false
PAYMENT_CALLBACK_TOKEN=${CALLBACK_TOKEN}
PAYMENT_ALLOWED_IPS=

# === 微信支付（待配置）===
WXPAY_APP_ID=
WXPAY_MCH_ID=
WXPAY_API_V3_KEY=
WXPAY_MCH_PRIVATE_KEY_PATH=/app/certs/apiclient_key.pem
WXPAY_MCH_SERIAL_NO=
WXPAY_NOTIFY_URL=http://${SERVER_IP}/api/v1/payment/wxpay/notify

# === 支付宝（待配置）===
ALIPAY_APP_ID=
ALIPAY_APP_PRIVATE_KEY=
ALIPAY_ALIPAY_PUBLIC_KEY=
ALIPAY_NOTIFY_URL=
ALIPAY_GATEWAY=

# === 管理员（填写你的邮箱，首个用户自动成为超管）===
ADMIN_EMAILS=

# === 限流 ===
RATE_LIMIT_PER_MINUTE=60

# === 免费配额 ===
FREE_PLAN_PROJECT_LIMIT=3
FREE_PLAN_SIMULATION_LIMIT_PER_WEEK=3
FREE_PLAN_EXPORT_LIMIT_PER_WEEK=3
ENVBACKEND

# --- docker-compose 的 DB 密码 ---
cat > "$APP_DIR/.env" << ENVCOMPOSE
DB_PASSWORD=${DB_PASSWORD}
DEV_TOKEN=
IMAGE_TAG=latest
ENVCOMPOSE

# --- 前端 .env.production ---
cat > "$APP_DIR/web/.env.production" << ENVWEB
NEXT_PUBLIC_API_BASE=
ENVWEB

log "环境变量已写入"

# === Step 8: 配置 Nginx（HTTP 模式，无域名）===
info "Step 8/8: 配置 Nginx..."

cat > "$APP_DIR/nginx/conf.d/default.conf" << 'NGINXCONF'
# HTTP 模式（无域名，IP 直接访问）
# 后续绑定域名后替换为 HTTPS 配置
# 注意：limit_req_zone 已在 nginx.conf 中定义，此处不重复

upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name _;

    # 安全
    server_tokens off;
    client_max_body_size 20M;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # 静态资源缓存
    location /_next/static/ {
        proxy_pass http://frontend;
        proxy_cache_valid 200 365d;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # 微信域名验证
    location ~ ^/MP_verify_.*\.txt$ {
        root /usr/share/nginx/html;
    }

    # 认证接口 - 严格限流
    location /api/v1/auth/ {
        limit_req zone=login_limit burst=3 nodelay;
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    # 支付接口
    location /api/v1/payment/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # 通用 API
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # 前端（Next.js）
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
        return 404;
    }

    location ~* \.(env|git|htaccess) {
        deny all;
        return 404;
    }
}
NGINXCONF

log "Nginx 配置已写入（HTTP 模式）"

# === 完成 ===
echo ""
echo "=========================================="
echo -e "  ${GREEN}初始化完成！${NC}"
echo "=========================================="
echo ""
echo "  服务器 IP:    ${SERVER_IP}"
echo "  项目目录:     ${APP_DIR}"
echo "  访问地址:     http://${SERVER_IP}"
echo ""
echo -e "  ${YELLOW}待手动完成:${NC}"
echo "  1. 编辑 server/.env.production 填入 DeepSeek API Key"
echo "  2. 编辑 server/.env.production 填入 ADMIN_EMAILS（你的邮箱）"
echo "  3. 编辑 server/.env.production 填入 SMTP 配置（发验证码用）"
echo "  4. cd /opt/dataAnalysisAgent && docker compose up -d --build"
echo ""
echo -e "  ${CYAN}密钥已自动生成（无需记忆，已写入配置文件）:${NC}"
echo "  - DB 密码:      ${DB_PASSWORD:0:8}..."
echo "  - JWT 密钥:     ${JWT_SECRET:0:8}..."
echo "  - 回调 Token:   ${CALLBACK_TOKEN:0:8}..."
echo ""
echo "  完整密钥保存在: ${APP_DIR}/server/.env.production"
echo ""
