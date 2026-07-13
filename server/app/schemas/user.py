"""用户相关模型。"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UserBase(BaseModel):
    """用户基础字段。"""

    openid: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    plan: str = "free"
    plan_expires_at: Optional[datetime] = None


class UserCreate(UserBase):
    """创建用户。"""

    pass


class UserResponse(UserBase):
    """用户响应。"""

    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
