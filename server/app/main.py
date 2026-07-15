"""应用入口。"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.database import init_db, close_db
from app.core.exceptions import AppException
from app.core.middleware import RequestLoggingMiddleware, limiter
from app.core.responses import error_response
from app.api.v1 import router as v1_router

# 配置日志
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理。"""
    # 启动时
    logger.info("启动数据分析智能体 API...")
    await init_db()
    logger.info("数据库初始化完成")
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
    allow_origins=[settings.FRONTEND_URL] if settings.DEBUG else [settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# 全局异常处理
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
    logger.error(f"未捕获异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=error_response(50000, "服务器内部错误"),
    )


# 注册路由
app.include_router(v1_router, prefix="/api")


@app.get("/health")
async def health():
    """健康检查。"""
    return {"status": "ok", "service": "data-analysis-agent"}
