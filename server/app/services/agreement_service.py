"""协议同意记录服务。"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_agreements import UserAgreement
from app.models.user import User


class AgreementService:
    """协议同意记录服务（合规 F-SYS-005/006）。"""

    @staticmethod
    async def record_agreement(
        db: AsyncSession,
        user_id: uuid.UUID,
        agreement_type: str,
        agreement_version: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> UserAgreement:
        """记录用户同意协议。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            agreement_type: 协议类型（terms_of_service / academic_integrity / simulation_disclaimer）
            agreement_version: 协议版本号
            ip_address: 用户IP地址
            user_agent: 浏览器UA
            
        Returns:
            UserAgreement: 协议同意记录
        """
        # 检查是否已存在相同记录
        stmt = select(UserAgreement).where(
            UserAgreement.user_id == user_id,
            UserAgreement.agreement_type == agreement_type,
            UserAgreement.agreement_version == agreement_version,
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            return existing
        
        # 创建新记录
        agreement = UserAgreement(
            id=uuid.uuid4(),
            user_id=user_id,
            agreement_type=agreement_type,
            agreement_version=agreement_version,
            agreed_at=datetime.now(timezone.utc),
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.now(timezone.utc),
        )
        db.add(agreement)
        await db.flush()
        
        return agreement

    @staticmethod
    async def has_agreed(
        db: AsyncSession,
        user_id: uuid.UUID,
        agreement_type: str,
        agreement_version: str,
    ) -> bool:
        """检查用户是否已同意指定版本的协议。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            agreement_type: 协议类型
            agreement_version: 协议版本号
            
        Returns:
            bool: 是否已同意
        """
        stmt = select(UserAgreement).where(
            UserAgreement.user_id == user_id,
            UserAgreement.agreement_type == agreement_type,
            UserAgreement.agreement_version == agreement_version,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def get_user_agreements(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> List[UserAgreement]:
        """获取用户的所有协议同意记录。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            
        Returns:
            list[UserAgreement]: 协议同意记录列表
        """
        stmt = (
            select(UserAgreement)
            .where(UserAgreement.user_id == user_id)
            .order_by(UserAgreement.agreed_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def update_user_agreed_terms(
        db: AsyncSession,
        user_id: uuid.UUID,
        agreement_version: str,
    ) -> None:
        """更新用户的 agreed_terms_version 和 agreed_terms_at 字段。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            agreement_version: 协议版本号
        """
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user:
            user.agreed_terms_version = agreement_version
            user.agreed_terms_at = datetime.now(timezone.utc)
            await db.flush()


# 当前协议版本配置
AGREEMENT_VERSIONS = {
    "terms_of_service": "1.0.0",
    "academic_integrity": "1.0.0",
    "simulation_disclaimer": "1.0.0",
}
