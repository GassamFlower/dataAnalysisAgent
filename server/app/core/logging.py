"""日志配置。"""
import logging
import os
import sys
from logging.handlers import RotatingFileHandler

from app.core.config import settings


def setup_logging():
    """配置日志。"""
    # 日志格式
    log_format = "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # 根日志配置
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # 控制台输出
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(log_format, date_format))
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
        file_handler.setFormatter(logging.Formatter(log_format, date_format))
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
