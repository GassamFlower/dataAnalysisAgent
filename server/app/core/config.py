"""应用配置。从环境变量 / .env 读取。"""
from pathlib import Path
from pydantic_settings import BaseSettings

# .env 文件路径相对于本文件所在目录（server/），确保从任何 CWD 都能正确加载
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # DeepSeek
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_V3_MODEL: str = "deepseek-chat"      # R1~R3 理解 / 推断 / 解析
    DEEPSEEK_R1_MODEL: str = "deepseek-reasoner"  # R4 硬伤诊断推理

    # 服务
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # 前端（CORS）
    FRONTEND_URL: str = "http://localhost:3000"

    # 数据库（开发环境用 SQLite，生产环境用 PostgreSQL）
    DATABASE_URL: str = "sqlite+aiosqlite:///./data_analysis_agent.db"

    # 安全（JWT）
    JWT_SECRET_KEY: str = ""  # 生产环境必须设置
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天

    # 开发模式（仅 DEBUG=True 时允许 dev-token）
    DEV_TOKEN: str = "dev-token"
    ALLOW_DEV_TOKEN: bool = True  # 生产环境设为 False

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

    class Config:
        env_file = str(_ENV_FILE)
        case_sensitive = True


settings = Settings()
