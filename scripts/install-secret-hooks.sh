#!/bin/bash
# 安装本地 pre-commit 密钥扫描钩子。
# 用法: bash scripts/install-secret-hooks.sh
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_SRC="$REPO_ROOT/githooks/pre-commit"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "✗ 未找到 $HOOK_SRC"
  exit 1
fi

if [ -f "$HOOK_DST" ] && ! grep -q "secret" "$HOOK_DST" 2>/dev/null; then
  echo "⚠️  .git/hooks/pre-commit 已存在且非本项目生成，跳过安装（可手动合并）。"
  exit 0
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "✓ 已安装密钥扫描 pre-commit 钩子 → $HOOK_DST"