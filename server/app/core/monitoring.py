"""监控告警服务。

提供：
- 5xx 错误告警
- 数据库连接健康检查
- 告警通知（邮件/Webhook）
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)


class MonitoringService:
    """监控告警服务。"""

    @staticmethod
    async def check_database_health(db: AsyncSession) -> dict:
        """检查数据库连接健康状态。

        Returns:
            {
                "healthy": bool,
                "latency_ms": float,
                "error": str | None
            }
        """
        start = datetime.now(timezone.utc)
        try:
            # 执行简单查询测试连接
            await db.execute(text("SELECT 1"))
            latency = (datetime.now(timezone.utc) - start).total_seconds() * 1000

            return {
                "healthy": True,
                "latency_ms": round(latency, 2),
                "error": None,
            }
        except Exception as e:
            latency = (datetime.now(timezone.utc) - start).total_seconds() * 1000
            logger.error(
                "Database health check failed",
                exc_info=True,
                extra={
                    "latency_ms": round(latency, 2),
                    "error": str(e),
                },
            )
            return {
                "healthy": False,
                "latency_ms": round(latency, 2),
                "error": str(e),
            }

    @staticmethod
    async def alert_5xx_error(
        method: str,
        path: str,
        status_code: int,
        error_message: str,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        """5xx 错误告警。

        当前实现：记录 ERROR 日志。
        后续可扩展：发送邮件、Webhook 通知等。
        """
        logger.error(
            f"5xx Error: {method} {path} -> {status_code}",
            extra={
                "method": method,
                "path": path,
                "status_code": status_code,
                "error_message": error_message,
                "request_id": request_id,
                "user_id": user_id,
            },
            exc_info=True,
        )

        # TODO: 后续可扩展告警通知
        # if settings.ALERT_WEBHOOK_URL:
        #     await send_webhook_alert(...)
        # if settings.ALERT_EMAIL_ENABLED:
        #     await send_email_alert(...)

    @staticmethod
    async def get_health_status(db: AsyncSession) -> dict:
        """获取系统整体健康状态。

        Returns:
            {
                "status": "healthy" | "degraded" | "unhealthy",
                "database": {...},
                "timestamp": str
            }
        """
        db_health = await MonitoringService.check_database_health(db)

        # 判断整体状态
        if db_health["healthy"]:
            status = "healthy"
        else:
            status = "unhealthy"

        return {
            "status": status,
            "database": db_health,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# 便捷函数
async def check_database_health(db: AsyncSession) -> dict:
    """检查数据库健康状态（便捷函数）。"""
    return await MonitoringService.check_database_health(db)


async def get_health_status(db: AsyncSession) -> dict:
    """获取系统健康状态（便捷函数）。"""
    return await MonitoringService.get_health_status(db)
