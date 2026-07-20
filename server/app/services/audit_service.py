"""审计日志记录服务。"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_logs import AuditLog


class AuditService:
    """审计日志记录服务（合规 F-SYS-008）。"""

    @staticmethod
    async def log_action(
        db: AsyncSession,
        user_id: uuid.UUID,
        action_type: str,
        project_id: Optional[uuid.UUID] = None,
        action_detail: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """记录操作日志。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            action_type: 操作类型（data_import/analysis_run/report_export/data_export/simulation_generate/dimension_edit/reverse_toggle）
            project_id: 关联项目ID（可选）
            action_detail: 操作详情（可选）
            ip_address: 用户IP地址（可选）
            user_agent: 浏览器UA（可选）
            
        Returns:
            AuditLog: 审计日志记录
        """
        log = AuditLog(
            id=uuid.uuid4(),
            user_id=user_id,
            project_id=project_id,
            action_type=action_type,
            action_detail=action_detail or {},
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.now(timezone.utc),
        )
        db.add(log)
        await db.flush()
        
        return log

    @staticmethod
    async def check_anomaly(
        db: AsyncSession,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
        action_type: str,
        time_window_hours: int = 1,
        threshold: int = 10,
    ) -> bool:
        """检测异常行为。
        
        检测规则：同一项目在指定时间窗口内，同一操作类型超过阈值次数。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            project_id: 项目ID
            action_type: 操作类型
            time_window_hours: 时间窗口（小时），默认1小时
            threshold: 阈值次数，默认10次
            
        Returns:
            bool: 是否异常（True=异常）
        """
        time_threshold = datetime.now(timezone.utc) - timedelta(hours=time_window_hours)
        
        stmt = (
            select(func.count(AuditLog.id))
            .where(
                and_(
                    AuditLog.user_id == user_id,
                    AuditLog.project_id == project_id,
                    AuditLog.action_type == action_type,
                    AuditLog.created_at >= time_threshold,
                )
            )
        )
        
        result = await db.execute(stmt)
        count = result.scalar() or 0
        
        return count >= threshold

    @staticmethod
    async def get_user_logs(
        db: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLog]:
        """获取用户操作日志。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            limit: 返回数量限制，默认100
            offset: 偏移量，默认0
            
        Returns:
            List[AuditLog]: 审计日志列表
        """
        stmt = (
            select(AuditLog)
            .where(AuditLog.user_id == user_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_project_logs(
        db: AsyncSession,
        project_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLog]:
        """获取项目操作日志。
        
        Args:
            db: 数据库会话
            project_id: 项目ID
            limit: 返回数量限制，默认100
            offset: 偏移量，默认0
            
        Returns:
            List[AuditLog]: 审计日志列表
        """
        stmt = (
            select(AuditLog)
            .where(AuditLog.project_id == project_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_logs_by_time_range(
        db: AsyncSession,
        start_time: datetime,
        end_time: datetime,
        user_id: Optional[uuid.UUID] = None,
        action_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[AuditLog]:
        """按时间范围查询日志。
        
        Args:
            db: 数据库会话
            start_time: 开始时间
            end_time: 结束时间
            user_id: 用户ID（可选）
            action_type: 操作类型（可选）
            limit: 返回数量限制，默认100
            
        Returns:
            List[AuditLog]: 审计日志列表
        """
        conditions = [
            AuditLog.created_at >= start_time,
            AuditLog.created_at <= end_time,
        ]
        
        if user_id:
            conditions.append(AuditLog.user_id == user_id)
        
        if action_type:
            conditions.append(AuditLog.action_type == action_type)
        
        stmt = (
            select(AuditLog)
            .where(and_(*conditions))
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def cleanup_old_logs(
        db: AsyncSession,
        retention_days: int = 365,
    ) -> int:
        """清理过期日志。
        
        根据合规要求，审计日志保留1年。此方法用于清理超过保留期的日志。
        
        Args:
            db: 数据库会话
            retention_days: 保留天数，默认365天（1年）
            
        Returns:
            int: 删除的日志数量
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=retention_days)
        
        # 先查询要删除的数量
        count_stmt = (
            select(func.count(AuditLog.id))
            .where(AuditLog.created_at < cutoff_time)
        )
        count_result = await db.execute(count_stmt)
        delete_count = count_result.scalar() or 0
        
        if delete_count > 0:
            # 执行删除
            delete_stmt = (
                AuditLog.__table__.delete()
                .where(AuditLog.created_at < cutoff_time)
            )
            await db.execute(delete_stmt)
            await db.flush()
        
        return delete_count


# 操作类型常量
ACTION_TYPES = {
    "DATA_IMPORT": "data_import",
    "ANALYSIS_RUN": "analysis_run",
    "REPORT_EXPORT": "report_export",
    "DATA_EXPORT": "data_export",
    "SIMULATION_GENERATE": "simulation_generate",
    "DIMENSION_EDIT": "dimension_edit",
    "REVERSE_TOGGLE": "reverse_toggle",
}
