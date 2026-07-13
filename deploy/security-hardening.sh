#!/bin/bash
# 安全加固脚本 - 适用于 Ubuntu 20.04/22.04
# 使用方法：sudo bash security-hardening.sh

set -e

echo "=========================================="
echo "  数据分析 Agent - 安全加固脚本"
echo "=========================================="

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then
    echo "错误：请使用 sudo 运行此脚本"
    exit 1
fi

echo ""
echo "步骤 1/6: 更新系统包..."
apt-get update -y
apt-get upgrade -y

echo ""
echo "步骤 2/6: 安装安全工具..."
apt-get install -y \
    fail2ban \
    ufw \
    unattended-upgrades

echo ""
echo "步骤 3/6: 配置防火墙 (UFW)..."
# 重置防火墙
ufw --force reset

# 默认策略
ufw default deny incoming
ufw default allow outgoing

# 允许 SSH（重要！防止锁定自己）
ufw allow ssh
echo "  ✓ SSH 端口已开放"

# 允许 HTTP（Nginx）
ufw allow http
echo "  ✓ HTTP 80 端口已开放"

# 允许 1Panel 端口（默认 9999，可根据实际修改）
read -p "请输入 1Panel 面板端口（默认 9999）: " PANEL_PORT
PANEL_PORT=${PANEL_PORT:-9999}
ufw allow $PANEL_PORT/tcp
echo "  ✓ 1Panel 端口 $PANEL_PORT 已开放"

# 启用防火墙
ufw --force enable
echo "  ✓ 防火墙已启用"

echo ""
echo "步骤 4/6: 配置 Fail2ban（防暴力破解）..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# 忽略的 IP（本地测试可添加）
ignoreip = 127.0.0.1/8 ::1

# 封禁时间（秒）
bantime = 3600

# 查找时间窗口（秒）
findtime = 600

# 最大失败次数
maxretry = 5

# 后端
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 10
findtime = 300
bantime = 86400
EOF

systemctl enable fail2ban
systemctl restart fail2ban
echo "  ✓ Fail2ban 已配置并启动"

echo ""
echo "步骤 5/6: 配置自动安全更新..."
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
EOF

systemctl enable unattended-upgrades
echo "  ✓ 自动安全更新已启用"

echo ""
echo "步骤 6/6: 生成 JWT 密钥..."
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "  ✓ JWT 密钥已生成：$JWT_SECRET"
echo ""
echo "  ⚠️  请将此密钥复制到 server/.env.production 的 JWT_SECRET_KEY 字段"

echo ""
echo "=========================================="
echo "  安全加固完成！"
echo "=========================================="
echo ""
echo "后续步骤："
echo "1. 修改 server/.env.production："
echo "   - JWT_SECRET_KEY=$JWT_SECRET"
echo "   - FRONTEND_URL=http://你的服务器IP"
echo "   - DEEPSEEK_API_KEY=你的API密钥"
echo ""
echo "2. 修改 web/.env.production："
echo "   - NEXT_PUBLIC_API_BASE=http://你的服务器IP/api"
echo ""
echo "3. 启动应用："
echo "   docker-compose up -d"
echo ""
echo "4. 检查状态："
echo "   docker-compose ps"
echo "   docker-compose logs -f"
echo ""
echo "5. 查看防火墙状态："
echo "   sudo ufw status"
echo ""
echo "6. 查看 Fail2ban 状态："
echo "   sudo fail2ban-client status"
echo ""
echo "安全建议："
echo "- 定期更新系统：sudo apt update && sudo apt upgrade"
echo "- 监控日志：sudo tail -f /var/log/fail2ban.log"
echo "- 备份数据：定期备份数据库和配置文件"
echo "- 考虑购买域名 + SSL 证书以提升安全性"
echo ""
