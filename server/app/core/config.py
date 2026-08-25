"""应用配置。从环境变量 / .env 读取。"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env 文件路径相对于本文件所在目录（server/），确保从任何 CWD 都能正确加载
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # 环境标识
    ENVIRONMENT: str = "development"

    # DeepSeek
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_V4_FLASH_MODEL: str = "deepseek-v4-flash"  # 默认模型：理解 / 推断 / 解析 / 轻量诊断
    DEEPSEEK_V4_PRO_MODEL: str = "deepseek-v4-pro"      # 复杂推理备选：深度因果诊断

    # 备选 LLM（Kimi / Qwen）
    KIMI_API_KEY: str = ""
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_K3_MODEL: str = "kimi-k3"
    QWEN_API_KEY: str = ""
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_37_MAX_MODEL: str = "qwen3.7-max"
    QWEN_36_FLASH_MODEL: str = "qwen3.6-flash"

    # 服务
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False  # 生产默认关闭，开发环境在 .env 中显式开启

    # 前端（CORS）
    FRONTEND_URL: str = "http://localhost:3000"

    # 数据库（开发环境用 SQLite，生产环境用 PostgreSQL）
    DATABASE_URL: str = "sqlite+aiosqlite:///./data_analysis_agent.db"

    # 安全（JWT）
    JWT_SECRET_KEY: str = ""  # 生产环境必须设置
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 15  # access token 15 分钟
    JWT_REFRESH_EXPIRE_MINUTES: int = 60 * 24 * 7  # refresh token 7 天

    # 安全（密码重置 JWT）—— 必须与登录 JWT 密钥不同
    RESET_JWT_SECRET_KEY: str = ""  # 生产环境必须设置

    # 开发模式（仅 DEBUG=True 时允许 dev-token）
    DEV_TOKEN: str = ""  # 默认空，开发环境在 .env 中显式设置
    ALLOW_DEV_TOKEN: bool = False  # 生产环境必须保持 False
    # dev-token 用户是否拥有管理员权限（仅开发模式生效；默认 False，避免误开后门）
    DEV_USER_IS_ADMIN: bool = False

    # 初始管理员（逗号分隔的邮箱）——应用启动时会自动将这些邮箱对应的账号晋升为 is_admin（bootstrap）
    ADMIN_EMAILS: str = ""

    # 客服微信号（售后占位，Task 2.3）
    # 留空 = 前端显示"敬请期待"占位态；填入真实微信号后只改这一处配置，前端入口即切换为可复制真实号的形态
    CUSTOMER_SERVICE_WECHAT_ID: str = ""

    # 微信公众号网页授权
    WECHAT_APP_ID: str = ""
    WECHAT_APP_SECRET: str = ""
    # 网页授权回调地址（前端 BFF 回调路由完整 URL，如 https://example.com/api/auth/callback）
    WECHAT_REDIRECT_URI: str = ""

    # 邮件 SMTP 配置（用于邮箱注册验证码、密码重置）
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""  # 邮箱授权码（非登录密码）
    SMTP_FROM_NAME: str = "预演"
    # 前端基础 URL（用于拼重置密码链接）
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # 速率限制
    RATE_LIMIT_PER_MINUTE: int = 60

    # 支付回调安全（微信支付/支付宝服务端 → 本服务）
    # 签名 token：与支付渠道约定，用于校验 X-Payment-Signature 请求头
    PAYMENT_CALLBACK_TOKEN: str = ""
    # IP 白名单（逗号分隔）；生产环境应配置为微信支付/支付宝回调服务器 IP
    # 留空表示不启用 IP 白名单（仅靠签名校验）
    PAYMENT_ALLOWED_IPS: str = ""

    # ── 微信支付 Native（扫码）──
    # 开通微信支付后从商户平台获取（pay.weixin.qq.com → 账户中心 → API安全）
    WXPAY_APP_ID: str = ""          # 关联的公众号/小程序 AppID（收款需要用，Native 支付需公众号）
    WXPAY_MCH_ID: str = ""          # 商户号 mchid（10位数字）
    WXPAY_API_V3_KEY: str = ""      # APIv3 密钥（32位）
    WXPAY_MCH_CERT_SERIAL: str = "" # 商户 API 证书序列号（十六进制字符串）
    # 商户 API 私钥文件路径（apiclient_key.pem）；生产环境放入 Docker 目录或 env 注入内容
    WXPAY_MCH_PRIVATE_KEY_PATH: str = ""
    # APIv3 平台证书序列号 + 文件路径（回调验签用；建议配置，未配则仅本地测试）
    WXPAY_PLATFORM_CERT_SERIAL: str = ""
    WXPAY_PLATFORM_CERT_PATH: str = ""
    # 支付结果回调 URL（HTTPS 必填，如 https://你的域名/api/v1/payment/wxpay/notify）
    WXPAY_NOTIFY_URL: str = ""
    # 前端支付成功后的回跳地址（可选）
    WXPAY_REDIRECT_URL: str = ""

    # 套餐限制
    FREE_PLAN_PROJECT_LIMIT: int = 3
    FREE_PLAN_SIMULATION_LIMIT_PER_WEEK: int = 3
    FREE_PLAN_EXPORT_LIMIT_PER_WEEK: int = 3

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        case_sensitive=True,
    )


settings = Settings()
