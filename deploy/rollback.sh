#!/bin/bash
# ============================================================
# 回滚脚本：一键回退到指定（或上一）镜像版本。
# 用法：
#   sudo bash deploy/rollback.sh                    # 回滚到上一版本
#   sudo bash deploy/rollback.sh <TAG>              # 回滚到指定标签
# 说明：依赖 docker-compose.yml 的 IMAGE_TAG 标签化镜像，
#       .release.current 记录当前生效版本。
# ============================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'; NC=$'\033[0m'

CURRENT_FILE=".release.current"
CURRENT_TAG=""
[ -f "$CURRENT_FILE" ] && CURRENT_TAG="$(cat "$CURRENT_FILE")"
[ -z "$CURRENT_TAG" ] && CURRENT_TAG="latest"

TARGET_TAG="${1:-latest}"

[ -f .env ] && export DB_PASSWORD="$(grep '^DB_PASSWORD=' .env | cut -d= -f2- || true)"

echo -e "${YELLOW}═══ 回滚 ═══${NC}"
echo -e "  当前版本 : ${GREEN}$CURRENT_TAG${NC}"
echo -e "  回滚到   : ${GREEN}$TARGET_TAG${NC}"

if [ "$TARGET_TAG" == "$CURRENT_TAG" ]; then
  echo -e "${YELLOW}  ⚠️  目标与当前相同，确认镜像在本地可用即可。${NC}"
fi

# 校验目标镜像存在
if ! docker image inspect "${IMAGE_REGISTRY:-daa-backend}:$TARGET_TAG" >/dev/null 2>&1; then
  echo -e "${RED}✗ 未找到本地镜像 ${IMAGE_REGISTRY:-daa-backend}:$TARGET_TAG${NC}"
  docker images | grep -E "IMAGE|daa-" || true
  exit 1
fi

echo -e "\n${GREEN}== 回滚到 $TARGET_TAG ...${NC}"
if IMAGE_TAG="$TARGET_TAG" docker compose up -d --no-build 2>&1; then
  sleep 8
  for url in "http://127.0.0.1:8000/health" "http://127.0.0.1:3000/"; do
    curl -fsS --max-time 20 "$url" >/dev/null 2>&1 \
      && echo -e "${GREEN}  ✓ $url OK${NC}" \
      || echo -e "${YELLOW}  ⚠️  $url 未就绪，请人工检查${NC}"
  done
  echo "$TARGET_TAG" > "$CURRENT_FILE"
  echo -e "${GREEN}✓ 已回滚到 $TARGET_TAG${NC}"
else
  echo -e "${RED}✗ 回滚失败，请人工介入: docker compose ps / logs${NC}"
  exit 1
fi