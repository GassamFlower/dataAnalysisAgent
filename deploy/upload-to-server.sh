#!/bin/bash
# ============================================================
# 本地执行：打包上传代码到服务器
# 用法：在项目根目录运行 bash deploy/upload-to-server.sh
# ============================================================

set -euo pipefail

SERVER_IP="${1:-123.206.203.112}"
SERVER_USER="${2:-ubuntu}"
REMOTE_DIR="/opt/dataAnalysisAgent"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}=== 统计小课堂 - 代码上传 ===${NC}"
echo -e "  目标: ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}"
echo ""

# 创建临时打包目录
TMPDIR=$(mktemp -d)
ARCHIVE="$TMPDIR/daa-code.tar.gz"

echo -e "${GREEN}[1/3]${NC} 打包代码（排除大文件）..."
tar czf "$ARCHIVE" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.venv*' \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.git' \
  --exclude='*.db' \
  --exclude='server/outputs/*' \
  --exclude='outputs/*' \
  --exclude='vibe_images' \
  --exclude='.doc-backup' \
  --exclude='tsconfig.tsbuildinfo' \
  -C "$(dirname "$0")/.." \
  .

SIZE=$(du -h "$ARCHIVE" | cut -f1)
echo -e "  打包完成: $SIZE"

echo -e "${GREEN}[2/3]${NC} 上传到服务器..."
scp "$ARCHIVE" "${SERVER_USER}@${SERVER_IP}:/tmp/daa-code.tar.gz"

echo -e "${GREEN}[3/3]${NC} 服务器端解压..."
ssh "${SERVER_USER}@${SERVER_IP}" bash -s << REMOTE
  set -euo pipefail
  sudo mkdir -p ${REMOTE_DIR}
  sudo tar xzf /tmp/daa-code.tar.gz -C ${REMOTE_DIR}
  sudo rm /tmp/daa-code.tar.gz
  sudo chown -R ubuntu:ubuntu ${REMOTE_DIR}
  echo "解压完成: \$(ls ${REMOTE_DIR} | wc -l) 个文件/目录"
REMOTE

# 清理临时文件
rm -rf "$TMPDIR"

echo ""
echo -e "${GREEN}[✓] 代码上传完成！${NC}"
echo ""
echo "下一步："
echo "  1. SSH 到服务器: ssh ${SERVER_USER}@${SERVER_IP}"
echo "  2. 运行初始化:   sudo bash ${REMOTE_DIR}/deploy/init-server.sh"
echo ""
