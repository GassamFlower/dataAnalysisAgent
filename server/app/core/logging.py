"""日志配置。

支持两种格式：
- 开发环境：人类可读的文本格式
- 生产环境：JSON 结构化日志（便于日志采集和分析）
"""
import json
import logging
import os
import sys
import traceback
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

from app.core.config import settings


class JSONFormatter(logging.Formatter):
    """JSON 结构化日志格式器。

    输出格式：
    {
        "timestamp": "2026-01-29T12:00:00.000Z",
        "level": "ERROR",
        "logger": "app.api.v1.auth",
        "message": "Login failed",
        "module": "auth",
        "line": 42,
        "exc_info": null
    }
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
            "function": record.funcName,
        }

        # 添加额外字段
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            log_entry["user_id"] = record.user_id
        if hasattr(record, "ip_address"):
            log_entry["ip_address"] = record.ip_address
        if hasattr(record, "status_code"):
            log_entry["status_code"] = record.status_code
        if hasattr(record, "method"):
            log_entry["method"] = record.method
        if hasattr(record, "path"):
            log_entry["path"] = record.path
        if hasattr(record, "duration_ms"):
            log_entry["duration_ms"] = record.duration_ms

        # 异常信息
        if record.exc_info:
            log_entry["exc_info"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_entry, ensure_ascii=False)


def setup_logging():
    """配置日志。"""
    # 根日志配置
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # 根据环境选择格式器
    if settings.DEBUG:
        # 开发环境：人类可读格式
        log_format = "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s"
        date_format = "%Y-%m-%d %H:%M:%S"
        formatter = logging.Formatter(log_format, date_format)
    else:
        # 生产环境：JSON 结构化格式
        formatter = JSONFormatter()

    # 控制台输出
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 文件输出（生产环境）
    if not settings.DEBUG:
        # 日志目录：优先使用 LOG_DIR 环境变量，默认当前目录
        log_dir = os.environ.get("LOG_DIR", ".")
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "app.log")

        file_handler = RotatingFileHandler(
            log_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

        # 设置日志文件权限为 0o640（owner 读写，group 只读，others 无权限）
        # 防止日志文件被其他用户读取（可能包含敏感信息）
        try:
            os.chmod(log_path, 0o640)
        except OSError:
            # Windows 下 chmod 行为不同，忽略错误
            pass

    # 降低第三方库日志级别
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


# 模块级日志器
logger = logging.getLogger(__name__)
