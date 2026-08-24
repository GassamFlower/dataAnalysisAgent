"""应用入口。"""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.database import init_db, close_db, get_db
from app.core.exceptions import AppException
from app.core.middleware import RequestLoggingMiddleware, limiter
from app.core.responses import error_response, success_response
from app.api.v1 import router as v1_router
from app.services.llm.config_service import reload_from_db

# 配置日志
setup_logging()
logger = logging.getLogger(__name__)

# Python 最低版本：与 Dockerfile (python:3.11-slim) 及代码中 dict[str, ...] / X|None 语法对齐。
# 在本地/CI 用旧解释器启动会立刻报错而不是神秘 import 失败。
_MIN_PYTHON = (3, 11)
if sys.version_info < _MIN_PYTHON:
    raise RuntimeError(
        "数据分析 Agent 需要 Python >= 3.11（当前 "
        f"{sys.version_info.major}.{getattr(sys.version_info, 'minor')}）。"
        "请升级解释器或重建 venv/pyenv/Poetry，并运行 .python-version 确认 3.11。"
        "触发宪法第 22 章『Python 3.8 断裂即升级 3.11/3.12』。"
    )


def _validate_production_settings() -> None:
    """生产环境启动前强制校验关键安全配置。

    校验失败直接抛出异常，阻止服务以不安全配置启动。
    """
    if settings.ENVIRONMENT != "production":
        return

    if settings.DEBUG:
        raise RuntimeError("生产环境必须设置 DEBUG=False")
    if settings.ALLOW_DEV_TOKEN:
        raise RuntimeError("生产环境必须设置 ALLOW_DEV_TOKEN=False")
    if not settings.JWT_SECRET_KEY or len(settings.JWT_SECRET_KEY) < 32:
        raise RuntimeError("生产环境 JWT_SECRET_KEY 必须至少 32 位")
    if not settings.RESET_JWT_SECRET_KEY or len(settings.RESET_JWT_SECRET_KEY) < 32:
        raise RuntimeError("生产环境 RESET_JWT_SECRET_KEY 必须至少 32 位")
    if settings.RESET_JWT_SECRET_KEY == settings.JWT_SECRET_KEY:
        raise RuntimeError("生产环境 RESET_JWT_SECRET_KEY 必须与 JWT_SECRET_KEY 不同")

    # 支付回调：生产必须同时具备签名 token 与 IP 白名单，否则拒绝回调
    if not settings.PAYMENT_CALLBACK_TOKEN:
        raise RuntimeError("生产环境必须设置 PAYMENT_CALLBACK_TOKEN（支付回调签名）")
    if not settings.PAYMENT_ALLOWED_IPS:
        raise RuntimeError("生产环境必须设置 PAYMENT_ALLOWED_IPS（支付渠道 IP 白名单）")

    # 数据库必须在启动前就绪（避免 init_db 内裸抛；生产禁止退回 SQLite 默认）
    if not settings.DATABASE_URL or settings.DATABASE_URL.startswith("sqlite"):
        raise RuntimeError("生产环境必须设置 DATABASE_URL 为 PostgreSQL 连接串（禁止使用 SQLite 默认）")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理。"""
    # 启动时
    _validate_production_settings()
    logger.info("启动数据分析智能体 API...")
    await init_db()
    logger.info("数据库初始化完成")
    # 管理员 bootstrap：将 ADMIN_EMAILS 声明的账号自动晋升为管理员（F-ADM / 立项 G1）
    try:
        from app.core.database import async_session
        from app.services.admin_service import promote_configured_emails
        async with async_session() as _sess:
            await promote_configured_emails(_sess)
    except Exception as exc:  # noqa: BLE001 启动晋升失败不应阻断服务
        logger.warning("管理员 bootstrap 失败（可忽略，稍后用 CLI 补齐）: %s", exc)
    await reload_from_db()
    logger.info("LLM 配置加载完成")
    yield
    # 关闭时
    logger.info("关闭数据分析智能体 API...")
    await close_db()
    logger.info("数据库连接已关闭")


app = FastAPI(
    title="数据分析智能体 API",
    description="问卷研究预演工具后端",
    version="0.1.0",
    lifespan=lifespan,
)

# 速率限制器
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 中间件（注意顺序：后添加的先执行）
# 1. 速率限制（最外层，限制所有请求）
app.add_middleware(SlowAPIMiddleware)

# 2. 请求日志
app.add_middleware(RequestLoggingMiddleware)

# 3. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """为所有响应注入安全响应头。

    - X-Content-Type-Options: nosniff —— 阻止 MIME 嗅探
    - X-Frame-Options: DENY —— 防止点击劫持（页面不可被 iframe 嵌入）
    - Referrer-Policy: strict-origin-when-cross-origin —— 限制 Referer 泄露
    - Content-Security-Policy: default-src 'self' —— 默认仅允许同源资源加载
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response


# 全局异常处理
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """处理 Starlette HTTP 异常（404 等），统一为 ErrorResponse 格式。"""
    if exc.status_code == 404:
        logger.info(f"路由未找到: {request.method} {request.url.path}")
        return JSONResponse(
            status_code=404,
            content=error_response(40400, "请求的资源不存在"),
        )
    logger.warning(f"HTTP 异常: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(exc.status_code * 100, str(exc.detail)),
    )


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """处理自定义异常。"""
    logger.warning(f"业务异常: {exc.code} - {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(exc.code, exc.message, exc.details),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理 Pydantic 请求体校验异常，统一为 ErrorResponse 格式。"""
    errors = exc.errors()
    # 提取第一个错误的 loc + msg 作为主要信息（确保可序列化）
    safe_errors = []
    for err in errors:
        safe_err = {
            "type": str(err.get("type", "")),
            "loc": [str(l) for l in err.get("loc", [])],
            "msg": str(err.get("msg", "参数校验失败")),
        }
        safe_errors.append(safe_err)
    first = safe_errors[0] if safe_errors else {}
    loc = " -> ".join(first.get("loc", []))
    msg = first.get("msg", "参数校验失败")
    detail = f"{loc}: {msg}" if loc else msg
    logger.info(f"参数校验失败: {detail}")
    return JSONResponse(
        status_code=422,
        content=error_response(42200, detail, {"errors": safe_errors}),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """处理未捕获异常。"""
    from app.core.monitoring import MonitoringService
    
    # 记录错误日志
    logger.error(f"未捕获异常: {exc}", exc_info=True)
    
    # 5xx 告警
    await MonitoringService.alert_5xx_error(
        method=request.method,
        path=request.url.path,
        status_code=500,
        error_message=str(exc),
        request_id=getattr(request.state, "request_id", None),
    )
    
    return JSONResponse(
        status_code=500,
        content=error_response(50000, "服务器内部错误"),
    )


# 注册路由
app.include_router(v1_router, prefix="/api")


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    """健康检查（含数据库连接检测）。"""
    from app.core.monitoring import get_health_status
    
    health_status = await get_health_status(db)
    
    # 如果不健康，返回 503
    if health_status["status"] != "healthy":
        return JSONResponse(
            status_code=503,
            content=error_response(50300, "服务不健康", health_status),
        )
    
    return success_response(data=health_status)
