#!/bin/bash
# 数据分析 Agent - 一键部署脚本
# 适用于 Ubuntu 20.04/22.04
# 使用方法：sudo bash deploy.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  数据分析 Agent - 一键部署脚本${NC}"
echo -e "${BLUE}==========================================${NC}"

# 检查 root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误：请使用 sudo 运行此脚本${NC}"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo -e "\n${BLUE}项目目录: $PROJECT_DIR${NC}"

# ============================================
# 步骤 1: 安装 Docker
# ============================================
echo -e "\n${BLUE}[1/6] 检查 Docker 环境...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker 未安装，开始安装...${NC}"
    
    # 安装依赖
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release
    
    # 添加 Docker 官方 GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # 添加 Docker 仓库
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装 Docker
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # 启动并设置开机自启
    systemctl enable docker
    systemctl start docker
    
    echo -e "${GREEN}  ✓ Docker 安装完成${NC}"
else
    echo -e "${GREEN}  ✓ Docker 已安装: $(docker --version)${NC}"
fi

# 检查 docker compose
if docker compose version &> /dev/null; then
    echo -e "${GREEN}  ✓ Docker Compose 可用${NC}"
elif command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}  ⚠️  使用旧版 docker-compose，建议升级${NC}"
else
    echo -e "${YELLOW}安装 Docker Compose 插件...${NC}"
    apt-get install -y docker-compose-plugin
fi

# ============================================
# 步骤 2: 安全加固
# ============================================
echo -e "\n${BLUE}[2/6] 安全加固...${NC}"

# 安装安全工具
apt-get install -y fail2ban ufw unattended-upgrades > /dev/null 2>&1

# 配置防火墙
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
echo -e "${GREEN}  ✓ 防火墙已配置（仅开放 SSH + 80 端口）${NC}"

# 配置 Fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-botsearch]
enabled = true
port = http
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 10
findtime = 300
bantime = 86400
EOF

systemctl enable fail2ban > /dev/null 2>&1
systemctl restart fail2ban > /dev/null 2>&1
echo -e "${GREEN}  ✓ Fail2ban 已启动（SSH 3次失败封禁1小时）${NC}"

# 自动安全更新
echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades
systemctl enable unattended-upgrades > /dev/null 2>&1
echo -e "${GREEN}  ✓ 自动安全更新已启用${NC}"

# ============================================
# 步骤 3: 生成配置文件
# ============================================
echo -e "\n${BLUE}[3/6] 生成配置文件...${NC}"

# 获取服务器公网 IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "YOUR_SERVER_IP")
echo -e "  服务器公网 IP: ${YELLOW}${SERVER_IP}${NC}"

# 生成 JWT 密钥
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || openssl rand -base64 32)

# 生成数据库密码
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

# 生成 .env 文件（根目录，docker-compose 读取）
if [ ! -f .env ]; then
    cat > .env << EOF
# 数据库密码
DB_PASSWORD=${DB_PASSWORD}

# 开发 Token（生产环境建议关闭，设为随机值）
DEV_TOKEN=$(openssl rand -hex 16)
EOF
    echo -e "${GREEN}  ✓ .env 已生成${NC}"
else
    echo -e "${YELLOW}  ⚠️  .env 已存在，跳过${NC}"
    # 读取已有的密码
    DB_PASSWORD=$(grep DB_PASSWORD .env | cut -d'=' -f2)
fi

# 生成后端 .env.production
if [ ! -f server/.env.production ] || [ "$1" == "--force" ]; then
    cat > server/.env.production << EOF
# 生产环境配置 - 数据分析 Agent 后端

# LLM API（Agnes AI - OpenAI 兼容接口）
DEEPSEEK_API_KEY=sk-4c02FDZrjpEkmqhpDuj1G72Cmi4vdYKoo9x26FhooLzJmumT
DEEPSEEK_BASE_URL=https://apihub.agnes-ai.com/v1

# 模型配置（V3 用于 R1~R3，R1 用于 R4 诊断，均用 agnes-2.0-flash）
DEEPSEEK_V3_MODEL=agnes-2.0-flash
DEEPSEEK_R1_MODEL=agnes-2.0-flash

# 服务配置
HOST=0.0.0.0
PORT=8000
DEBUG=false

# 前端地址（CORS）
FRONTEND_URL=http://${SERVER_IP}

# JWT 密钥
JWT_SECRET_KEY=${JWT_SECRET}
EOF
    echo -e "${GREEN}  ✓ server/.env.production 已生成（含 Agnes AI 配置）${NC}"
else
    echo -e "${YELLOW}  ⚠️  server/.env.production 已存在，跳过（如需重新生成用 --force）${NC}"
fi

# 生成前端 .env.production
cat > web/.env.production << EOF
# 客户端同源访问，留空
NEXT_PUBLIC_API_BASE=
EOF
echo -e "${GREEN}  ✓ web/.env.production 已生成${NC}"

# ============================================
# 步骤 4: 检查配置
# ============================================
echo -e "\n${BLUE}[4/6] 检查配置...${NC}"

if grep -q "your_api_key_here" server/.env.production 2>/dev/null; then
    echo -e "${RED}  ✗ LLM API_KEY 未配置，请编辑 server/.env.production${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ 配置检查通过（Agnes AI 已配置）${NC}"

# --start 参数才继续构建
if [ "$1" != "--start" ]; then
    echo ""
    echo -e "${YELLOW}配置已就绪，运行以下命令启动：${NC}"
    echo -e "  ${BLUE}sudo bash deploy/deploy.sh --start${NC}"
    exit 0
fi

# ============================================
# 步骤 5: 构建并启动
# ============================================
echo -e "\n${BLUE}[5/6] 构建并启动服务...${NC}"

# 创建 Nginx 日志目录
mkdir -p nginx/logs

# 构建镜像
echo -e "${YELLOW}  构建镜像中（可能需要几分钟）...${NC}"
docker compose build 2>&1 | tail -5

# 启动服务
echo -e "${YELLOW}  启动服务...${NC}"
docker compose up -d

# 等待服务启动
echo -e "${YELLOW}  等待服务启动...${NC}"
sleep 10

# ============================================
# 步骤 6: 验证部署
# ============================================
echo -e "\n${BLUE}[6/6] 验证部署...${NC}"

# 检查容器状态
echo -e "\n${YELLOW}容器状态：${NC}"
docker compose ps

# 测试健康检查
echo -e "\n${YELLOW}健康检查：${NC}"
if curl -s http://localhost/health | grep -q "ok\|true\|healthy" 2>/dev/null; then
    echo -e "${GREEN}  ✓ 后端健康检查通过${NC}"
else
    echo -e "${YELLOW}  ⚠️  后端可能还在启动中，稍后重试${NC}"
fi

if curl -s http://localhost/ | grep -q "html\|body\|next" 2>/dev/null; then
    echo -e "${GREEN}  ✓ 前端访问正常${NC}"
else
    echo -e "${YELLOW}  ⚠️  前端可能还在启动中，稍后重试${NC}"
fi

# 输出结果
echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC} http://${SERVER_IP}"
echo ""
echo -e "${BLUE}常用命令:${NC}"
echo -e "  查看日志:   ${YELLOW}docker compose logs -f${NC}"
echo -e "  重启服务:   ${YELLOW}docker compose restart${NC}"
echo -e "  停止服务:   ${YELLOW}docker compose down${NC}"
echo -e "  更新代码后: ${YELLOW}docker compose up -d --build${NC}"
echo ""
echo -e "${BLUE}安全提示:${NC}"
echo -e "  ${YELLOW}• 当前为 HTTP 明文，建议后期加域名 + SSL${NC}"
echo -e "  ${YELLOW}• 查看防火墙: sudo ufw status${NC}"
echo -e "  ${YELLOW}• 查看封禁: sudo fail2ban-client status${NC}"
echo ""
