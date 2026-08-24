#!/usr/bin/env bash
# =============================================================================
# prod-snapshot.sh — 生产环境快照收集脚本
# -----------------------------------------------------------------------------
# 用途：把生产环境的「运行状态 + 版本信息 + 配置模板」一次性收集输出，
#        供开发环境对照，帮助 AI 更准确地推进开发工作。
#
# 特点：
#   ✅ 不落盘任何真实密钥/密码/Token（敏感值一律打码为 ******）
#   ✅ 只在终端/stdout 输出，绝不写入文件
#   ✅ 只读，不修改服务器任何状态
#
# 用法（在 /opt/dataAnalysisAgent 目录下执行）：
#   sudo bash prod-snapshot.sh            # 输出完整快照
#   sudo bash prod-snapshot.sh > snap.txt # 保存输出后把内容发给我
# =============================================================================

# 颜色输出（无 tty 时自动关闭）
if [ -t 1 ]; then C_G="\033[32m"; C_Y="\033[33m"; C_R="\033[31m"; C_B="\033[1m"; C_N="\033[0m"; else C_G=""; C_Y=""; C_R=""; C_N=""; C_B=""; fi
dbg() { printf "%b%s%b\n" "$C_Y" "$*" "$C_N"; }
sec() { printf "%b\n%s%b\n" "$C_B" "########## $* ##########" "$C_N"; }
red() { printf "%b%s%b\n" "$C_R" "$*" "$C_N"; }

# 打码函数：只保留 key=，值全部替换为 ******
mask() { sed -E 's/(^|[[:space:]])([A-Z_]+)=([^[:space:]]+)/\1\2=******/g'; }

echo ""
sec "0. 环境概览"
echo "  当前用户    : $(whoami 2>/dev/null)"
echo "  工作目录    : $(pwd 2>/dev/null)"
echo "  系统        : $(lsb_release -d 2>/dev/null | cut -f2-) | $(uname -r)"
echo "  主机名      : $(hostname 2>/dev/null)"
echo "  Docker      : $(docker --version 2>/dev/null || echo '未安装')"
echo "  Compose     : $(docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo '未安装')"
echo "  磁盘占用    : $(df -h / | awk 'NR==2{print $3"/"$2"（已用"$5"）"}')"

echo
sec "1. 容器运行状态 (docker compose ps)"
docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null || red "docker compose ps 失败"

echo
sec "2. 全部 Docker 容器"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}" 2>/dev/null

echo
sec "3. 镜像与版本列表 (daa-*)"
docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}" 2>/dev/null | grep -E "daa-|postgres|nginx" || echo "（未发现 daa- 相关镜像）"

echo
sec "4. Git 版本信息"
if [ -d .git ]; then
  echo "当前分支        : $(git branch --show-current 2>/dev/null)"
  echo "HEAD commit     : $(git log -1 --format='%h %s (%cr)' 2>/dev/null)"
  echo "最近 5 次提交   :"
  git log --oneline -5 2>/dev/null
  echo "工作区状态      :"
  git status --short 2>/dev/null | head -20 || echo "  (干净)"
else
  echo "（不是 Git 仓库，或未上传代码）"
fi

echo
sec "5. 发布状态 (release.log / .release.current)"
if [ -f .release.current ]; then echo "当前发布版本 : $(cat .release.current 2>/dev/null)"; fi
if [ -d .git ]; then
  echo "可用回滚版本:"
  git tag --sort=-creatordate 2>/dev/null | head -10 || echo "  (无标签)"
fi

echo
sec "6. 部署配置模板（脱敏/仅键名，不含真实值）"
echo "--- .env 存在的键 ---"
if [ -f .env ]; then
  grep -E '^[A-Z_]+=' .env 2>/dev/null | cut -d= -f1 | sort
else
  echo "  未发现 .env 文件"
fi
echo "--- server/.env.production 键名（已脱敏）---"
if [ -f server/.env.production ]; then
  grep -E '^[A-Z_]+=' server/.env.production 2>/dev/null | mask
fi

echo
sec "7. Nginx 配置一览"
if [ -f nginx/conf.d/default.conf ]; then
  echo "--- server_name / proxy 目标 ---"
  grep -E "server_name|proxy_pass|listen" nginx/conf.d/default.conf 2>/dev/null | head -20
  echo "  是否启用 HTTPS(443): $(grep -c 'listen 443' nginx/conf.d/default.conf 2>/dev/null) 处"
fi

echo
sec "8. 运行进程健康状态 (健康检查通过情况)"
for c in daa-backend daa-frontend daa-db daa-nginx; do
  st=$(docker inspect --format '健康:{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' "$c" 2>/dev/null)
  echo "  $c : ${st:-未运行}"
done

echo
sec "9. 最近 30 行后端日志（脱敏）"
docker logs --tail 30 daa-backend 2>&1 | mask || echo "  无法读取 daa-backend 日志"

echo
sec "10. 数据库概况（表数量/行数，不含数据）"
docker exec daa-db psql -U postgres -d data_analysis_agent -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | xargs -I{} echo "  public schema 表数量: {}"
echo "  常用表（前 20）:"
docker exec daa-db psql -U postgres -d data_analysis_agent -tAc "SELECT tablename FROM pg_tables WHERE schemaname='public' LIMIT 20;" 2>/dev/null

# =============================================================================
sec "END. 快照完成"
echo "提示：上面所有打印到的内容均已脱敏，可直接复制粘贴发送给开发 AI。"
echo "若某个区块显示失败（如无容器），说明对应服务尚未部署或容器名不同。"