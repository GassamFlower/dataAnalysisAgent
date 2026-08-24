# 正式上线筹备操作单（LAUNCH PREP）

> 目标：把当前 HTTP 明文阶段的 `124.223.21.212` 升级为**可正式对外运营**的生产环境。
> 前置：业务代码已通过验收（上线门已过）；本文档只处理部署/运维/合规 3 类硬缺口。
> 基线：commit HEAD `2fb626b`（含 release.sh 健康检查修复）、生产 4 容器 healthy。

---

## 0. 现状与差距（一句话）

后端代码质量达标，但生产尚未满足「上线阻断」项，按优先级处理：

| 优先级 | 项 | 状态 |
|-------|-----|------|
| 🔴 P0 | HTTP 明文，无 TLS | **未满足** |
| 🔴 P0 | 生产密钥含占位/未全注入 | **需确认/补** |
| 🟡 P1 | 支付回调需真实 token + IP 白名单 | **未满足**（当前直接拒绝回调） |
| 🟡 P1 | `FRONTEND_URL` 仍是 `http://<ip>` | 需随域名改 https |
| 🟢 P2 | 资料/工具禁入 | 已处理 |

---

## P0-1：HTTPS（域名 + 证书）

### 前置决策：是否需要域名？
- **正式对外运营强烈建议域名**（微信登录、支付、SSL 证书、HTTPS 都需要域名）。
- 若暂时无域名、仅内部/测试用，可**跳过此节**，但需接受"非素数生产"的事实。

### 若使用域名（推荐 certbot 自动获取证书）
在你的服务器执行（把 `<domain>` 替换成真实域名）：

```bash
# 1. 安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. 停掉 nginx 容器对 80 的占用（certbot 需要直接绑 80，或用 standalone）
#    —— 方式 A：用 standalone 模式，临时停 nginx
docker compose stop nginx
#    —— 方式 B：如果想 certbot --nginx，需先在宿主机有 nginx 或直接编辑配置
#    先停下 Docker nginx，释放 80
docker compose stop nginx

# 3. 申请并签发证书（standalone）
sudo certbot certonly --standalone -d <your_domain.com>

# 4. 把证书放到 docker 映射的 nginx/ssl 目录
sudo cp /etc/letsencrypt/live/<your_domain.com>/fullchain.pem nginx/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/<your_domain.com>/privkey.pem   nginx/ssl/privkey.pem

# 5. 用仓库里的 HTTPS 模板覆盖 default.conf（其中 <你的域名> 替换）
cp nginx/https.default.conf.template nginx/conf.d/default.conf
#   手动把文件里的 <你的域名> 替换为真实域名

# 6. 启动 nginx，reload
docker compose up -d --force-recreate nginx
```

> ⚠️ 服务器上 `default.conf` 当前被 `assume-unchanged` 标记。替换内容后记得重新告诉 git（可选）：
> `git add -f nginx/conf.d/default.conf` 或移除 ignore。但记得这样会导致生产 HTTP 版被 HTTP 替换——**这正是我们想要的（HTTPS）。**

### 手动方式（已有证书）
直接把文件放 `nginx/ssl/`，并替换 `nginx/conf.d/default.conf` 为 https 模板。

---

## P0-2：生产密钥补齐（必做）

在**服务器**编辑 `server/.env.production`（该文件被 gitignore，不会入库），补齐以下密钥。

**必须确认 / 生成强随机值：**
```bash
cd /opt/dataAnalysisAgent
# 生成随机密钥（每次不同）
python3 -c "import secrets; print('JWT=', secrets.token_urlsafe(48)); print('RESET=', secrets.token_urlsafe(48)); print('PAY=', secrets.token_urlsafe(32))"
```

然后在 `server/.env.production` 填入：
```ini
JWT_SECRET_KEY=<长度为64位的随机值>
RESET_JWT_SECRET_KEY=<另一个不同随机值>
PAYMENT_CALLBACK_TOKEN=<随机值>        ;必须与支付渠道约定同一值
PAYMENT_ALLOWED_IPS=<支付渠道服务器IP,逗号分隔>
ALLOW_DEV_TOKEN=false
DEBUG=false
FRONTEND_URL=https://<你的域名>        ;若未上 HTTPS 则保持 http://<ip>
```

### 确认清单
- [ ] `JWT_SECRET_KEY` ≥32字符，非占位
- [ ] `RESET_JWT_SECRET_KEY` ≥32字符，非占位，且 ≠ JWT_SECRET_KEY
- [ ] `ALLOW_DEV_TOKEN=false`
- [ ] `DEBUG=false`
- [ ] `PAYMENT_CALLBACK_TOKEN` 已填（否则支付回调 403）
- [ ] `PAYMENT_ALLOWED_IPS` 已填渠道 IP
- [ ] `FRONTEND_URL` 与域名 `https` 一致
- [ ] `SMTP_HOST/USER/PASSWORD`（邮箱注册/重置密码需要）

改完重启：
```bash
docker compose up -d --force-recreate backend
docker compose logs backend | grep -iE "error|RuntimeError"   # 应无错误
```

---

## P1-1：支付回调（若启用支付）

- 需按 "P0-2" 配好 `PAYMENT_CALLBACK_TOKEN`（与渠道约定的签名 token）。
- `PAYMENT_ALLOWED_IPS` 填支付渠道官方回调 IP（微信/支付宝）。
- 未配好前，支付通知接口直接 403（这是**安全的默认拒绝**，不影响其他功能）。

---

## P1-2：微信 / SMTP / 初始管理员

- 若启用微信扫码登录：`WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`WECHAT_REDIRECT_URI` 需要。
- SMTP 邮箱验证/重置密码：`SMTP_HOST/PORT/USER/PASSWORD/FROM_NAME`。
- 首个管理员：在 `server/` 下执行 `python -m scripts.promote_admin <你的邮箱>`。

---

## P1-3：验证上线是否就绪

全部改完后，在服务器验证：

```bash
# 服务健康
docker compose ps            # 全部 Up + healthy

# 用真实域名验证 HTTPS（若有域名）
curl -s -o /dev/null -w "HTTP=%{http_code}\n" https://<your-domain.com>/
# 期望 200

# 验证 80 → 301 到 https
curl -s -o /dev/null -w "HTTP=%{http_code} redirect=%{redirect_url}\n" http://<your-domain.com>/
# 期望 301 + redirect_url = https://...

# 后端健康检查（容器内）
docker exec daa-backend python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').status)"
# 期望 200
```
---

## P2-2：生产数据保护

- [ ] 数据库自动备份 cron（DEPLOY_GUIDE 有配置）。
- [ ] `docker image prune -f`（勿 `-af`）保住回滚镜像。
- [ ] 确认 `migrate_dev_to_prod.py` 不会被误用（已有 `--dangerous` 门禁；**严禁在 cidding 时运行**）。

---

## 完成后回填

把「已执行」的步骤在下方勾选，作为上线完成的审计记录：

- [ ] HTTPS 已启用（域名 + 证书 + 301）
- [ ] 生产密钥全部非占位、已注入
- [ ] 支付回调已配置
- [ ] FRONTEND_URL 与访问方式一致
- [ ] 服务全部 healthy，http/https 访问正常
- [ ] 管理员已指定（`promote_admin`）

> 前置项全部完成后，即可把生产从「HTTP 明文/内测」正式切换到「HTTPS 对外运营」。