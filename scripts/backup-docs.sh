#!/bin/bash
# ============================================================
# docs/ 备份脚本（私有版本控制, 防丢失）
#
# 背景: docs/ 被主仓库 .gitignore 排除，出于保密不上公开 GitHub。
#       但裸依赖本机文件 → 一旦丢失无法找回。
# 方案: 在 .doc-backup/ 下建独立 git 库，定期把 docs/ 快照进去，
#       保留可回溯历史；如需异地备份，配置私有 remote 后自动 push。
#
# 用法:
#   bash scripts/backup-docs.sh                     # 备份 + 提交
#   bash scripts/backup-docs.sh --push              # 备份后再推送到私有 remote
#
# 配置私有 remote（一次性）:
#   bash scripts/backup-docs.sh --set-remote <git-url>
# 查看备份历史:
#   git -C .doc-backup log --oneline
# ============================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/.doc-backup"
DOCS_DIR="$PROJECT_DIR/docs"

GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'; NC=$'\033[0m'

[ ! -d "$DOCS_DIR" ] && { echo -e "${RED}✗ 未找到 docs/ 目录: $DOCS_DIR${NC}"; exit 1; }

if [ "${1:-}" == "--set-remote" ]; then
  [ -z "${2:-}" ] && { echo -e "${RED}用法: $0 --set-remote <git-url>${NC}"; exit 1; }
  git -C "$BACKUP_DIR" remote remove private 2>/dev/null || true
  git -C "$BACKUP_DIR" remote add private "$2"
  echo -e "${GREEN}✓ 已设置私有 remote: $2 (推送用 --push)${NC}"
  git -C "$BACKUP_DIR" remote -v
  exit 0
fi

# ---------- 初始化备份库 ----------
if [ ! -d "$BACKUP_DIR/.git" ]; then
  mkdir -p "$BACKUP_DIR"
  git init -q "$BACKUP_DIR"
  git -C "$BACKUP_DIR" config user.name "docs-backup" 2>/dev/null || true
  git -C "$BACKUP_DIR" config user.email "backup@local" 2>/dev/null || true
  cat > "$BACKUP_DIR/README.md" <<'EOF'
# docs/ 本地备份库
由脚本 `scripts/backup-docs.sh` 自动维护，仅本地用于防丢失与历史归档。
如需异地备份：`bash scripts/backup-docs.sh --set-remote <git-url>` 后 `--push`。
EOF
  echo -e "${GREEN}○ 已初始化备份库: $BACKUP_DIR${NC}"
fi

# ---------- 同步 docs → 备份库 ----------
echo -e "${GREEN}○ 同步 docs/ → .doc-backup/ ...${NC}"
# 用 rsync 镜像同步（含删除），把误删除的文档也从备份中移除
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude='.git/' --exclude='README.md' "$DOCS_DIR/" "$BACKUP_DIR/"
else
  # 退而求其次: 保留 .git 历史, 只重放工作区文件
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'README.md' -exec rm -rf {} + 2>/dev/null || true
  cp -R "$DOCS_DIR"/. "$BACKUP_DIR"/
fi
# 重新写入备份库自述（避免被 rsync 删除）
cat > "$BACKUP_DIR/README.md" <<'EOF'
# docs/ 本地备份库
由脚本 `scripts/backup-docs.sh` 自动维护，仅本地用于防丢失与历史归档。
如需异地备份：`bash scripts/backup-docs.sh --set-remote <git-url>` 后 `--push`。
EOF

# ---------- 提交 ----------
STAMP="$(date +%Y-%m-%d_%H%M%S)"
git -C "$BACKUP_DIR" add -A
if git -C "$BACKUP_DIR" diff --cached --quiet; then
  echo -e "${YELLOW}○ 无变更，跳过提交${NC}"
else
  # 简化 history: 进程内提交即可
  git -C "$BACKUP_DIR" commit -q -m "docs backup ${STAMP}"
  echo -e "${GREEN}✓ 已提交: docs backup ${STAMP}${NC}"
fi

# ---------- 可选推送 ----------
if [ "${1:-}" == "--push" ]; then
  if git -C "$BACKUP_DIR" remote get-url private >/dev/null 2>&1; then
    git -C "$BACKUP_DIR" push private HEAD
    echo -e "${GREEN}✓ 已推送私有 remote${NC}"
  else
    echo -e "${YELLOW}⚠️  未配置私有 remote，跳过推送（可: $0 --set-remote <git-url>）${NC}"
  fi
fi