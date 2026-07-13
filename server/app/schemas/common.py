"""通用响应模型。"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel

T = TypeVar("T")


class ResponseModel(BaseModel, Generic[T]):
    """统一响应格式。"""

    code: int = 0
    message: str = "success"
    data: Optional[T] = None


class ErrorResponse(BaseModel):
    """错误响应格式。"""

    code: int
    message: str
    details: Optional[dict] = None


class PaginationParams(BaseModel):
    """分页参数。"""

    page: int = 1
    page_size: int = 20


class PaginatedData(BaseModel, Generic[T]):
    """分页数据。"""

    items: List[T]
    total: int
    page: int
    page_size: int
