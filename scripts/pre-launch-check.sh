#!/bin/bash
# 上线前自动验证脚本
# 用法: bash scripts/pre-launch-check.sh
#
# 检查项：
#   1. Docker & 容器状态
#   2. 环境变量安全性
#   3. 网络 & 端口
#   4. HTTPS & 安全头
#   5. 数据库连通性
#   6. 备份配置
#   7. 磁盘 & 资源

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local result="$2"  # 0=pass, 1=fail, 2=warn

  if [ "$result" -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} $label"
    ((PASS++))
  elif [ "$result" -eq 2 ]; then
    echo -e "  ${YELLOW}⚠${NC} $label"
    ((WARN++))
  else
    echo -e "  ${RED}✗${NC} $label"
    ((FAIL++))
  fi
}

echo "=========================================="
echo "  上线前验证检查"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# --- 1. Docker ---
echo "【1/7】Docker & 容器"
if command -v docker &>/dev/null; then
  check "Docker 已安装" 0
else
  check "Docker 已安装" 1
fi

if docker compose ps --format '{{.Service}} {{.State}}' 2>/dev/null | grep -q "running"; then
  check "Docker Compose 可用" 0
else
  check "Docker Compose 可用" 1
fi

UNHEALTHY=$(docker compose ps --format '{{.Service}} {{.Health}}' 2>/dev/null | grep -cv "healthy" || true)
if [ "$UNHEALTHY" -eq 0 ]; then
  check "所有容器健康" 0
elif [ "$UNHEALTHY" -le 1 ]; then
  check "所有容器健康（$UNHEALTHY 个未就绪）" 2
else
  check "所有容器健康（$UNHEALTHY 个未就绪）" 1
fi

echo ""

# --- 2. 环境变量安全 ---
echo "【2/7】环境变量安全"
if [ -f "server/.env.production" ]; then
  check "server/.env.production 存在" 0

  if grep -q "DEBUG=true" server/.env.production 2>/dev/null; then
    check "DEBUG=false" 1
  else
    check "DEBUG=false" 0
  fi

  if grep -q "ALLOW_DEV_TOKEN=true" server/.env.production 2>/dev/null; then
    check "ALLOW_DEV_TOKEN=false" 1
  else
    check "ALLOW_DEV_TOKEN=false" 0
  fi

  JWT_LEN=$(grep "^JWT_SECRET_KEY=" server/.env.production 2>/dev/null | cut -d= -f2- | wc -c)
  if [ "$JWT_LEN" -ge 32 ]; then
    check "JWT_SECRET_KEY 长度 ≥ 32" 0
  else
    check "JWT_SECRET_KEY 长度 ≥ 32（当前 ${JWT_LEN}）" 1
  fi

  RESET_LEN=$(grep "^RESET_JWT_SECRET_KEY=" server/.env.production 2>/dev/null | cut -d= -f2- | wc -c)
  if [ "$RESET_LEN" -ge 32 ]; then
    check "RESET_JWT_SECRET_KEY 长度 ≥ 32" 0
  else
    check "RESET_JWT_SECRET_KEY 长度 ≥ 32（当前 ${RESET_LEN}）" 1
  fi

  JWT_VAL=$(grep "^JWT_SECRET_KEY=" server/.env.production 2>/dev/null | cut -d= -f2-)
  RESET_VAL=$(grep "^RESET_JWT_SECRET_KEY=" server/.env.production 2>/dev/null | cut -d= -f2-)
  if [ -n "$JWT_VAL" ] && [ -n "$RESET_VAL" ] && [ "$JWT_VAL" != "$RESET_VAL" ]; then
    check "两个 JWT 密钥不同" 0
  else
    check "两个 JWT 密钥不同" 1
  fi

  if grep -q "^DEEPSEEK_API_KEY=sk-" server/.env.production 2>/dev/null; then
    check "DeepSeek API Key 已配置" 0
  else
    check "DeepSeek API Key 已配置" 2
  fi

  if grep -q "^PAYMENT_CALLBACK_TOKEN=" server/.env.production 2>/dev/null; then
    VAL=$(grep "^PAYMENT_CALLBACK_TOKEN=" server/.env.production | cut -d= -f2-)
    if [ -n "$VAL" ] && [ "$VAL" != "changeme" ]; then
      check "支付回调 Token 已配置" 0
    else
      check "支付回调 Token 为占位符" 1
    fi
  else
    check "支付回调 Token 已配置" 2
  fi
else
  check "server/.env.production 存在" 1
fi

echo ""

# --- 3. Git 安全 ---
echo "【3/7】Git 安全"
ENV_IN_GIT=$(git ls-files 2>/dev/null | grep -c "\.env$" || true)
if [ "$ENV_IN_GIT" -eq 0 ]; then
  check ".env 文件未被 Git 追踪" 0
else
  check ".env 文件未被 Git 追踪（$ENV_IN_GIT 个）" 1
fi

if git diff --quiet 2>/dev/null; then
  check "Git 工作区干净" 0
else
  check "Git 工作区干净（有未提交变更）" 2
fi

echo ""

# --- 4. 网络 & 端口 ---
echo "【4/7】网络 & 端口"
if docker compose ps --format '{{.Service}} {{.Ports}}' 2>/dev/null | grep "backend" | grep -q "0.0.0.0:8000"; then
  check "后端端口未暴露到宿主机" 1
else
  check "后端端口未暴露到宿主机" 0
fi

if docker compose ps --format '{{.Service}} {{.Ports}}' 2>/dev/null | grep "db" | grep -q "0.0.0.0:5432"; then
  check "数据库端口未暴露到宿主机" 1
else
  check "数据库端口未暴露到宿主机" 0
fi

echo ""

# --- 5. 健康检查 ---
echo "【5/7】服务健康"
if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
  check "后端 /health 可达" 0
  HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null)
  if echo "$HEALTH" | grep -q '"healthy":true\|"healthy": true'; then
    check "数据库连接正常" 0
  else
    check "数据库连接正常" 1
  fi
else
  check "后端 /health 可达" 1
  check "数据库连接正常" 1
fi

if curl -sf http://localhost:3000/ >/dev/null 2>&1; then
  check "前端可达" 0
else
  check "前端可达" 1
fi

echo ""

# --- 6. 备份 ---
echo "【6/7】备份"
if crontab -l 2>/dev/null | grep -q "db-backup\|pg_dump"; then
  check "数据库备份 crontab 已配置" 0
else
  check "数据库备份 crontab 已配置" 1
fi

BACKUP_DIR="/opt/backups/postgres"
if [ -d "$BACKUP_DIR" ]; then
  BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sqlc" 2>/dev/null | wc -l)
  if [ "$BACKUP_COUNT" -gt 0 ]; then
    LATEST=$(ls -t "$BACKUP_DIR"/backup_*.sqlc 2>/dev/null | head -1)
    LATEST_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST" 2>/dev/null || echo 0)) / 86400 ))
    if [ "$LATEST_AGE" -le 2 ]; then
      check "最近备份存在（${LATEST_AGE}天前）" 0
    else
      check "最近备份存在（${LATEST_AGE}天前）" 2
    fi
  else
    check "有备份文件" 1
  fi
else
  check "备份目录存在" 2
fi

echo ""

# --- 7. 磁盘 & 资源 ---
echo "【7/7】磁盘 & 资源"
DISK_PCT=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -lt 70 ]; then
  check "磁盘使用率 < 70%（当前 ${DISK_PCT}%）" 0
elif [ "$DISK_PCT" -lt 80 ]; then
  check "磁盘使用率 < 70%（当前 ${DISK_PCT}%）" 2
else
  check "磁盘使用率 < 70%（当前 ${DISK_PCT}%）" 1
fi

MEM_PCT=$(free | awk '/Mem:/ {printf "%.0f", $3/$2*100}')
if [ "$MEM_PCT" -lt 80 ]; then
  check "内存使用率 < 80%（当前 ${MEM_PCT}%）" 0
else
  check "内存使用率 < 80%（当前 ${MEM_PCT}%）" 2
fi

echo ""
echo "=========================================="
echo -e "  结果: ${GREEN}$PASS 通过${NC}  ${YELLOW}$WARN 警告${NC}  ${RED}$FAIL 失败${NC}"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n  ${RED}有 $FAIL 项必须修复后才能上线！${NC}"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "\n  ${YELLOW}建议处理 $WARN 项警告后上线。${NC}"
  exit 0
else
  echo -e "\n  ${GREEN}全部通过，可以上线！${NC}"
  exit 0
fi
