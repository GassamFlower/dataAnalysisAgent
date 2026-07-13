"""中间件：速率限制 + 请求日志。"""
import time
from datetime import datetime
from typing import Callable

from fastapi import Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.config import Config as StarletteConfig
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

# 修复 Windows GBK 编码问题：starlette.Config 读取 .env 默认用系统编码（GBK），
# 而 .env 文件可能包含中文注释（UTF-8）。monkey-patch _read_file 强制 UTF-8。
_original_read_file = StarletteConfig._read_file


def _utf8_read_file(self, env_file):
    try:
        with open(env_file, encoding="utf-8") as f:
            return f.readlines()
    except (FileNotFoundError, OSError):
        return []


StarletteConfig._read_file = _utf8_read_file

# 速率限制器
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)

# 恢复原始方法，避免影响其他 starlette Config 使用
StarletteConfig._read_file = _original_read_file


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件：记录每个请求的方法、路径、耗时。"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        # 处理请求
        response = await call_next(request)

        # 计算耗时
        process_time = time.time() - start_time

        # 日志格式：[时间] 方法 路径 状态码 耗时
        log_line = (
            f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] "
            f"{request.method} {request.url.path} "
            f"{response.status_code} {process_time:.3f}s"
        )

        # 根据状态码选择日志级别
        if response.status_code >= 500:
            import logging
            logging.getLogger(__name__).error(log_line)
        elif response.status_code >= 400:
            import logging
            logging.getLogger(__name__).warning(log_line)
        else:
            import logging
            logging.getLogger(__name__).info(log_line)

        return response
