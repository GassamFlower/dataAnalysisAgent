#!/bin/bash
# ============================================================
# 发布脚本：构建新镜像 → 健康检查 → 失败自动回滚到上一版本
# 前提：docker-compose.yml 已支持 IMAGE_TAG 标签化镜像。
# 用法：sudo bash deploy/release.sh ["发布说明"]
# ============================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
PROJECT_DIR="$(pwd)"

# 配色
GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'; NC=$'\033[0m'

# ---------- 读取当前生效版本 ----------
CURRENT_FILE="$PROJECT_DIR/.release.current"
CURRENT_TAG=""
[ -f "$CURRENT_FILE" ] && CURRENT_TAG="$(cat "$CURRENT_FILE")"
[ -z "$CURRENT_TAG" ] && CURRENT_TAG="latest"

# ---------- 新版本号（默认 git 短哈希） ----------
NEW_TAG="$(git rev-parse --short=7 HEAD 2>/dev/null || echo "manual")"
DESC="${1:-$(git log -1 --oneline 2>/dev/null | cut -c1-80 || echo "手动发布")}"

echo -e "${YELLOW}═══ 发布: ${DESC} ${NC}"
echo -e "  当前版本(current): ${GREEN}$CURRENT_TAG${NC}"
echo -e "  新版本(new)      : ${GREEN}$NEW_TAG${NC}"
[ "$CURRENT_TAG" == "$NEW_TAG" ] && echo -e "${YELLOW}  ⚠️  与当前版本相同，可能重复发布${NC}"

# ---------- 获取小venables ----------
[ -f .env ] && export DB_PASSWORD="$(grep '^DB_PASSWORD=' .env | cut -d= -f2- || true)"

# ---------- 1. 构建 ----------
echo -e "\n${GREEN}==[1/4] 构建镜像 (IMAGE_TAG=$NEW_TAG) ...${NC}"
if ! IMAGE_TAG="$NEW_TAG" docker compose build backend frontend; then
  echo -e "${RED}✗ 构建失败，未影响线上服务。${NC}"
  exit 1
fi

# ---------- 2. 预检查上一版本镜像是否可用（回滚兜底） ----------
echo -e "\n${GREEN}==[2/4] 确认上一版本镜像可回滚 ...${NC}"
if ! docker image inspect "${IMAGE_REGISTRY:-daa-backend}:$CURRENT_TAG" >/dev/null 2>&1 \
   && [ "$CURRENT_TAG" != "latest" ]; then
  echo -e "${YELLOW}  ⚠️  上一版本镜像 ($CURRENT_TAG) 缺失；若本次失败将回滚到系统依赖。${NC}"
fi

# ---------- 3. 切换并健康检查 ----------
echo -e "\n${GREEN}==[3/4] 切换到新版本并健康检查 ...${NC}"
if IMAGE_TAG="$NEW_TAG" docker compose up -d --no-build 2>&1; then
  sleep 8
  HEALTHY=1
  for url in "http://127.0.0.1:8000/health" "http://127.0.0.1:3000/"; do
    if ! curl -fsS --max-time 20 "$url" >/dev/null 2>&1; then
      echo -e "${YELLOW}  ✗ 健康检查失败: $url${NC}"
      HEALTHY=0
    fi
  done
  if [ "$HEALTHY" -eq 1 ]; then
    echo "$NEW_TAG" > "$CURRENT_FILE"
    # 新成功 → 推进 latest 指向新版本
    docker tag "${IMAGE_REGISTRY:-daa-backend}:$NEW_TAG" "${IMAGE_REGISTRY:-daa-backend}:latest" || true
    docker tag "${IMAGE_REGISTRY:-daa-frontend}:$NEW_TAG" "${IMAGE_REGISTRY:-daa-frontend}:latest" || true
    echo -e "${GREEN}✓ 发布成功；当前版本 → $NEW_TAG${NC}"
    exit 0
  fi
fi

# ---------- 4. 健康检查失败 → 自动回滚 ----------
echo -e "\n${RED}✗ 新版本健康检查未通过，自动回滚到 $CURRENT_TAG ...${NC}"
if IMAGE_TAG="$CURRENT_TAG" docker compose up -d --no-build 2>&1; then
  sleep 8
  for url in "http://127.0.0.1:8000/health" "http://127.0.0.1:3000/"; do
    curl -fsS --max-time 20 "$url" >/dev/null 2>&1 || echo -e "${YELLOW}  ⚠️ 回滚后 $url 仍不可用，请人工介入${NC}"
  done
  echo -e "${GREEN}✓ 已回滚到 $CURRENT_TAG (请在控制台确认服务正常)${NC}"
else
  echo -e "${RED}✗ 回滚命令本身也失败！请人工介入: docker compose ps / logs${NC}"
fi
exit 1