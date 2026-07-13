"""自定义异常。"""
from typing import Any, Optional


class AppException(Exception):
    """应用基础异常。"""

    def __init__(
        self,
        code: int,
        message: str,
        details: Optional[dict] = None,
        status_code: int = 400,
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code
        super().__init__(message)


class NotFoundException(AppException):
    """资源未找到异常。"""

    def __init__(self, message: str = "资源未找到", details: Optional[dict] = None):
        super().__init__(code=40400, message=message, details=details, status_code=404)


class ValidationException(AppException):
    """参数验证异常。"""

    def __init__(self, message: str = "参数验证失败", details: Optional[dict] = None):
        super().__init__(code=40000, message=message, details=details, status_code=400)


class UnauthorizedException(AppException):
    """未授权异常。"""

    def __init__(self, message: str = "未授权", details: Optional[dict] = None):
        super().__init__(code=40100, message=message, details=details, status_code=401)


class ForbiddenException(AppException):
    """禁止访问异常。"""

    def __init__(self, message: str = "禁止访问", details: Optional[dict] = None):
        super().__init__(code=40300, message=message, details=details, status_code=403)


class BusinessException(AppException):
    """业务异常（60000-69999）。"""

    def __init__(
        self, code: int, message: str, details: Optional[dict] = None, status_code: int = 400
    ):
        if not (60000 <= code <= 69999):
            raise ValueError("业务异常 code 必须在 60000-69999 范围内")
        super().__init__(
            code=code, message=message, details=details, status_code=status_code
        )
