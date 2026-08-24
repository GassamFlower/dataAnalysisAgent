# 微信支付 Native 对接说明（dataAnalysisAgent）

> 目标：正式上线微信扫码支付，替换旧的「手动回调/模拟支付」链路。
> 本文件说明：怎么在 `.env.production` 注入凭证、怎么配回调、代码改了哪些、上线改什么。

---

## 1. 你在微信商户平台（pay.weixin.qq.com）准备的凭证

| 配置名（.env） | 含义 | 获取位置 |
|---|---|---|
| `WXPAY_APP_ID` | 关联的公众号 AppID | 公众平台 mp.weixin.qq.com（需与支付商户绑定） |
| `WXPAY_MCH_ID` | 商户号（10 位数字） | 商户平台首页 |
| `WXPAY_API_V3_KEY` | APIv3 密钥（32 位） | 商户平台 → 账户中心 → API安全 |
| `WXPAY_MCH_CERT_SERIAL` | 商户 API 证书序列号（hex） | 账户中心 → API安全 → 证书管理 |
| `WXPAY_MCH_PRIVATE_KEY_PATH` | `apiclient_key.pem` 的路径 | WXCertUtil 生成的目录（你的在 `E:\tool\WXCertUtil2026\cert`） |
| `WXPAY_PLATFORM_CERT_SERIAL` | 平台证书序列号（回调验签） | 见下方「平台证书」 |
| `WXPAY_PLATFORM_CERT_PATH` | 平台证书 `.pem` 路径 | 见下方「平台证书」 |
| `WXPAY_NOTIFY_URL` | 回调地址（HTTPS） | 你的正式域名，如 `https://yyds.com/api/v1/payment/wxpay/notify` |

> ⚠️ 安全：以上全为**敏感凭证**，只写入**服务器上的 `server/.env.production`**（已被 `.gitignore` 忽略），**严禁提交到仓库 / 前端**。私钥文件也不要放进公开目录。

---

## 2. 平台证书（回调验签必需）

微信支付回调验签用的是**平台证书**（v3 公钥），不是你的商户证书。
两种获取方式：
1. **推荐（自动轮换）**：在回调里根据 `Wechatpay-Serial` 请求头，调用
   `GET /v3/certificates`（文档：`微信支付平台证书`）动态下载，或
2. 手动从商户平台下载**平台证书（platform.pem）** 放服务器，填 `WXPAY_PLATFORM_CERT_PATH`。

> 本项目 `verify_notify_signature` 用 `WXPAY_PLATFORM_CERT_PATH` 验签。
> **未配置时生产默认拒绝回调（安全默认）。** 拿到平台证书后务必配置。

---

## 3. 在线申请依赖（你必须做的商户平台动作）

1. **商户号确认**（已完成）。
2. **APIv3 密钥**（已完成，32 位已设置）。
3. **API 证书/私钥**（已完成，`apiclient_key.pem`）。
4. **关联 AppID**：在商户平台「产品中心 → AppID账号管理」绑定你的公众号 AppID。
5. **申请开通 Native 支付**：`产品中心 → 支付产品 → Native 支付`（扫码支付）提交申请。
6. **配置支付回退 / 回调域名**：须在微信支付「开发配置」里将 `WXPAY_NOTIFY_URL` 所在的**已验证 HTTPS 域名**填入。（⚠️ 需要你的域名）

---

## 4. 代码改动清单（已落地）

**后端（server/）**
- `app/core/config.py`：新增 `WXPAY_*` 配置项（8 个）。
- `app/services/wechat_pay.py`（**新增**）：`create_native_order`（下单返回 code_url）、`query_wxpay_order`（查询）、`verify_notify_signature`（验签）、`decrypt_notify_resource`（AES-GCM 解密）。基于 httpx + cryptography，无第三方 SDK。
- `app/api/v1/payment.py`：新增
  - `POST /api/v1/payment/wxpay/{order_id}/qr` — 对 pending 订单发起微信 Native 下单，返回 `code_url`（登录态校验）。
  - `POST /api/v1/payment/wxpay/notify` — 微信回调：取 Wechatpay-* 请求头 → 验签 → 解密码 → 校验金额 → 更新订单 → 激活套餐（返回 `SUCCESS`）。
- `requirements.txt`：新增 `cryptography>=42.0.0`。

**前端（web/）**
- `lib/api/payment.ts`：新增 `createWxPayQr`、`queryOrder`。
- `lib/hooks/use-wechat-pay.ts`（新）：下单 → 取 code_url → 打开二维码 → 轮询订单直至 paid。
- `components/payment/wechat-pay-modal.tsx`（新）：二维码弹窗（`qrcode.react`，已存在依赖）。
- `app/api/payment/wxpay/[orderId]/qr/route.ts`（新）：BFF 转发。
- `app/(marketing)/pricing/page.tsx`：点击「购买/订阅」→ 先走微信 Native 扫码；若未配置微信则回落模拟支付（联调兜底）。

---

## 5. 生产上线步骤

> 顺序（关键）：**先配回调验签所需平台证书 + 域名，再 release**，否则支付不可用且可能启动后回调被拒。

1. **搞定域名 HTTPS**：拿到域名 → 配 nginx HTTPS（见 `nginx/https.default.conf.template`）→ 在微信支付后台填回调域名。
2. **服务器 `.env.production` 新增**：
   ```
   WXPAY_APP_ID=wx...
   WXPAY_MCH_ID=...10位
   WXPAY_API_V3_KEY=...32位v3key
   WXPAY_MCH_CERT_SERIAL=...
   WXPAY_MCH_PRIVATE_KEY_PATH=/app/certs/apiclient_key.pem
   WXPAY_PLATFORM_CERT_SERIAL=...
   WXPAY_PLATFORM_CERT_PATH=/app/certs/platform_cert.pem
   WXPAY_NOTIFY_URL=https://你的域名/api/v1/payment/wxpay/notify
   ```
3. **放置证书**：把 `apiclient_key.pem`、平台证书放进后端镜像/挂载目录（不提交仓库）。
4. **重新构建后端**（含 cryptography 依赖）→ `deploy/release.sh`。
5. **联调验证**：创建订单 → 调 `qr` 接口应返回 code_url → 微信扫码支付 → 回调落库 paid → 套餐激活。

---

## 6. 常见问题

- **下单报 401/签名错**：多半是 `WXPAY_MCH_CERT_SERIAL` 或私钥路径不对。
- **回调 401（验签拒绝）**：`WXPAY_PLATFORM_CERT_PATH` 未配或平台证书与回调序列号不符。
- **AppID 未绑定**：下单会报「appid 与 mchid 不匹配」。
- **Native 未开通**：下单返回「产品未开通」。
- **生产回调被拒**：确认 `ENVIRONMENT=production` 时平台证书存在。

---

## 7. 后续可选

- 对接平台证书**自动轮换**（`/v3/certificates`）。
- 前端在支付页显示「微信支付中…」更完善的状态；已做轮询。
- 增加 `refund`（`/v3/refund/domestic/refunds`）售后能力（当前未接）。