# 部署前核对清单（Deployment Pre-flight Checklist）

> 用途：每次发布生产前逐项核对，确保开发环境与生产状态真实同步、避免低级事故。
> 基于生产真实快照（2026-08-24, HEAD `d5dad64`）整理。
> 仓库路径：`deploy/DEPLOY_CHECKLIST.md`（随代码发布，生产 pull 即见）。

## 0. 关键事实速查（当前基线）

| 维度 | 生产当前值 | 备注 |
|------|-----------|------|
| 系统 | Ubuntu 24.04.4 / kernel 6.8 | |
| Docker / Compose | 29.4.2 / v5.1.3 | |
| Git HEAD | `d5dad64` | 本地需与该保持一致 |
| 数据库 | postgres:15-alpine, 21 表 | 结构由「Alembic + 启动自动补列」维护 |
| 代理 | HTTP 明文（Nginx 仅 80） | 尚未上域名/HTTPS（计划后置） |
| 主 LLM | DeepSeek（`deepseek-v4-flash`/`deepseek-v4-pro`） | 通过 `api.deepseek.com` |

---

## 一、磁盘 / 环境（每次发布前必查）

- [ ] 磁盘可用 ≥ 20%：`df -h /`
      - 现状 **79% 已用（8.1G 空闲）**，Build Cache 4.96G 可清 → **已触及警戒线，先清**
      - 清理命令：
        ```bash
        # 只清 build 缓存（不影响镜像/回滚）
        docker builder prune -f
        # 清理悬空镜像（保留 daa-* 与回滚 tag）
        docker image prune -f
        # 若仍紧张，查看可按 tag 删的旧镜像
        docker images | grep daa-
        # 删除指定的作废镜像（保留 rollback-* 与当前 tag）
        docker rmi <镜像ID>   # 逐个确认后再删
        ```
- [ ] Docker 服务健康：`docker compose ps` 全部 `Up`

---

## 2. Git 状态（发布安全阀）

- [ ] 工作区干净：`git status --short` 无改动
  - ⚠️ 注意：`nginx/conf.d/default.conf` 若由改动需先提交；
    `scripts/migrate_data.sql` 已从版本控制移除（见第 3 节），生产 `pull` 后应消失。
  - **发布前必须 commit 代码改动**，否则 `release.sh` 用 git 短哈希打 tag 会错乱 / 回滚失效。
- [ ] 本地 HEAD 与生产确认一致：`git rev-parse --short=7 HEAD`
- [ ] `git push origin main` 已同步（release 脚本依赖线上镜像可回滚）

---

## 3. 数据库（结构与数据）

- [ ] 启动日志无致命 DDL 报错：
  `docker compose logs backend 2>&1 | grep -iE "missing|failed|错误|fatal"`
- [ ] 确认「自动补列」正常（幂等、安全）：
  ```bash
  docker compose logs backend | grep "_sync_missing_columns"  # 仅提示，非错误
  ```
- [ ] **`migrate_data.sql` 已移除 git 跟踪**（本会话完成）：
  - 该脚本含 `DELETE FROM ...`，是开发→生产的一次性迁移遗留；
  - **绝不在生产自动执行**（现无代码引用）；手动执行前必须先备份。
  - 已执行 `git rm --cached scripts/migrate_data.sql`，并加入 `.gitignore`。
    → 生产 `git pull` 后该文件从工作区消失（本地若需保留，拷一份到别处）。
  - 结构变更统一走 Alembic：`alembic revision --autogenerate -m "..."`，生产 `alembic upgrade head`。
- [ ] 本地 SQLite 结构已与迁移对齐；生产 PostgreSQL 首次启动会自动补列（`init_db`）

---

## 4. LLM 与密钥（生产门禁）

- [ ] 主 provider 确认：后端实际走 `deepseek`（标准白名单 `deepseek/kimi/qwen`）
- [ ] ✅ LLM 主模型确认：`deepseek-v4-flash`/`deepseek-v4-pro` 经 `api.deepseek.com` **实测可调用**
      （该环境有模型名映射/网关，勿随意改成官方 `deepseek-chat`/`deepseek-reasoner` 等旧模型名）
- [ ] **`AGNES_*` 残留清理（生产手动加，代码不读）**：
      本地与代码均不使用；清理命令（在服务器上）：
      ```bash
      # 删除 AGNES_API_KEY / AGNES_BASE_URL / AGNES_MODEL 三行后重启 backend
      sed -i '/^AGNES_/d' server/.env.production
      docker compose up -d --force-recreate backend
      ```
- [ ] 生产启动门禁通过：`ENVIRONMENT=production + ALLOW_DEV_TOKEN=false`，后端能正常启动
- [ ] 密钥均由环境注入，`.env.production` 无明文

---

## 5. Nginx（当前 HTTP 阶段）

- [ ] 保持 `listen 80` + `server_name _`；**勿动**（HTTPS/域名后置）
- [ ] 若 `default.conf` 有未提交改动，确认是期望的线上版再提交
- [ ] HTTP 阶段 CORS: 前端 `FRONTEND_URL` 空（同源）符合现状

---

## 6. 发布 SOP（一键流程）

**发布前（本地）—确保代码已提交并推送：**
```bash
cd /opt/dataAnalysisAgent
git add -A
git commit -m "release: 发布说明"
git push origin main
```

**生产端一键发布（含安全预检，脚本自动拦截磁盘/脏 git）：**
```bash
cd /opt/dataAnalysisAgent
# 0. 同步代码
git pull origin main
# 1. 释放磁盘（非必须但强烈建议；勿 -af，会误删回滚镜像）
docker builder prune -f && docker image prune -f
# 2. 发布（内置: 磁盘>80%检查 + 脏git拦截 + migrate风险提示 + 失败自动回滚）
sudo bash deploy/release.sh "发布说明"
```

预期执行链：
- 成功 → `.release.current` 更新 + `latest` 推进
- 失败 → 自动回滚到上一版本（依赖本地历史镜像，勿 `docker image prune -af`）

**紧急回滚：**
```bash
sudo bash deploy/rollback.sh            # 回上一版本
sudo bash deploy/rollback.sh <OLD_TAG>  # 回指定 tag
```

---

## 7. 回滚

- [ ] 确认 `.release.current` 有可用版本
- [ ] 本地保留可回滚镜像（勿清理带 `rollback-*` tag）
- [ ] `sudo bash deploy/rollback.sh` 或带旧 TAG

---

> 维护：本清单随部署环境演进在 `deploy/DEPLOY_CHECKLIST.md` 更新。
> 会话基线：2026-08-24 `d5dad64`，HTTP 明文阶段，LLM=deepseek-v4 可用。