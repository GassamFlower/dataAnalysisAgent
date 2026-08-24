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

# ---------- 部署前预检 ----------
# 1) 磁盘空间：可用 < 20% 时强制中止，避免构建中磁盘写满
AVAIL_PCT="$(df -P / | awk 'NR==2{print $5}' | tr -d '%')"
if [ "$AVAIL_PCT" -gt 80 ] 2>/dev/null; then
  echo -e "${RED}✗ 磁盘已用 ${AVAIL_PCT}%（>80%），发布可能因磁盘写满失败。${NC}"
  echo -e "${YELLOW}  请先清理后再发布： docker builder prune -f && docker image prune -f${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 磁盘检查通过（已用 ${AVAIL_PCT}%）${NC}"

# 2) Git 工作区干净：未提交改动会导致 tag 错乱/回滚失效
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo -e "${YELLOW}⚠️  存在未提交改动(${NC}git status${YELLOW})。${NC}"
  echo -e "${YELLOW}   release 使用 git 短哈希打 tag，未提交会致镜像 tag 漂移。${NC}"
  read -r -p "  仍要强制继续发布?(y/N) " -n 1 CONFIRM || true; echo
  if [ "${CONFIRM:-n}" != "y" ] && [ "${CONFIRM:-n}" != "Y" ]; then
    echo -e "${RED}✗ 已取消。请先 commit 代码。${NC}"
    exit 1
  fi
fi

# 3) 数据迁移脚本风险提示（只提示不阻断）
if [ -f scripts/migrate_data.sql ]; then
  echo -e "⚠️  检测到 scripts/migrate_data.sql（含 DELETE，一次性迁移遗留）。"
  echo -e "   本脚本不会自动执行；结构变更请优先用 alembic。"
fi

# 读取当前生效版本 ----------
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

  # ✅ 健康检查改为「检查容器自身 healthcheck 状态」而非 curl 宿主端口（宿主并不映射 8000/3000）
  check_containers() {
    for c in daa-backend daa-frontend; do
      if ! docker inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null | grep -q healthy; then
        echo -e "${YELLOW}  ✗ 容器 $c 未达 healthy${NC}"
        return 1
      fi
    done
  }

  # 轮询等待容器达到 healthy（最长 60s，间隔 5s）；任一循环结束仍未全 healthy 则判定失败
  HEALTHY=0
  for i in $(seq 1 12); do
    sleep 5
    if check_containers; then HEALTHY=1; break; fi
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
  check_containers || echo -e "${YELLOW}  ⚠️ 回滚后仍有容器未达 healthy，请人工介入${NC}"
  echo -e "${GREEN}✓ 已回滚到 $CURRENT_TAG (请在控制台确认服务正常)${NC}"
else
  echo -e "${RED}✗ 回滚命令本身也失败！请人工介入: docker compose ps / logs${NC}"
fi
exit 1