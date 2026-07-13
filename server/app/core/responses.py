"""统一响应模型。"""
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ResponseModel(BaseModel, Generic[T]):
    """成功响应模型。"""

    code: int = 0
    message: str = "success"
    data: Optional[T] = None


class ErrorResponse(BaseModel):
    """错误响应模型。"""

    code: int
    message: str
    details: Optional[dict] = None


def success_response(data: Any = None, message: str = "success") -> dict:
    """构建成功响应。"""
    return {"code": 0, "message": message, "data": data}


def error_response(code: int, message: str, details: Optional[dict] = None) -> dict:
    """构建错误响应。"""
    return {"code": code, "message": message, "details": details or {}}
