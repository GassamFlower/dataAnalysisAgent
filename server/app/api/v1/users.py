"""用户个人中心 API。"""
import asyncio
import base64
import hashlib
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, File, Request, UploadFile
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ValidationException
from app.core.responses import success_response
from app.core.security import hash_password, verify_password
from app.core.error_messages import (
    ERR_USER_NOT_FOUND,
    ERR_VERIFY_CODE_EXPIRED_RESEND,
    ERR_VERIFY_CODE_INVALID,
)
from app.models.user import User
from app.services.audit_service import ACTION_TYPES, AuditService

router = APIRouter(prefix="/users", tags=["用户"])


# ── Schemas ──────────────────────────────────────────────


class ProfileUpdateRequest(BaseModel):
    nickname: str

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1 or len(v) > 20:
            raise ValueError("昵称长度需在 1~20 个字符之间")
        return v


class PasswordUpdateRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 6 or len(v) > 32:
            raise ValueError("密码长度需在 6~32 位之间")
        return v


class EmailChangeRequestRequest(BaseModel):
    new_email: str

    @field_validator("new_email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        import re

        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower().strip()


class EmailChangeConfirmRequest(BaseModel):
    new_email: str
    code: str

    @field_validator("new_email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        import re

        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower().strip()

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if len(v) != 6 or not v.isdigit():
            raise ValueError("验证码为 6 位数字")
        return v


# ── Helpers ──────────────────────────────────────────────


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def _hash_code(code: str) -> str:
    return bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "nickname": user.nickname,
        "avatar": user.avatar,
        "email_verified": user.email_verified,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


# ── Routes ───────────────────────────────────────────────


@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户信息。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException(ERR_USER_NOT_FOUND)
    return success_response(data=_user_dict(user))


@router.patch("/me/profile")
async def update_profile(
    req: ProfileUpdateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改昵称。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException(ERR_USER_NOT_FOUND)
    user.nickname = req.nickname
    await db.commit()

    # 审计：资料变更
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["PROFILE_UPDATE"],
        action_detail={"nickname": req.nickname},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return success_response(data={"nickname": user.nickname})


@router.patch("/me/password")
async def update_password(
    req: PasswordUpdateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改密码（需校验旧密码）。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException(ERR_USER_NOT_FOUND)
    if not user.password_hash:
        raise ValidationException("当前账号未设置密码")
    if not verify_password(req.old_password, user.password_hash):
        raise ValidationException("旧密码不正确")
    user.password_hash = hash_password(req.new_password)
    await db.commit()

    # 审计：密码修改（安全敏感操作）
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["PASSWORD_CHANGE"],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return success_response(message="密码修改成功")


@router.post("/me/email/change-request")
async def email_change_request(
    req: EmailChangeRequestRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发送新邮箱验证码。"""
    # 检查新邮箱是否已被其他用户使用
    result = await db.execute(
        select(User).where(User.email == req.new_email, User.id != current_user["id"])
    )
    if result.scalar_one_or_none():
        raise ValidationException("该邮箱已被其他用户使用")

    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException(ERR_USER_NOT_FOUND)

    code = _generate_code()
    user.email_verify_code_hash = _hash_code(code)
    user.email_verify_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.commit()

    # 异步发送邮件
    try:
        from app.services.email_service import send_verification_code

        await send_verification_code(req.new_email, code)
    except Exception:
        # 邮件发送失败不阻塞，开发环境可跳过
        pass

    return success_response(
        message="验证码已发送至新邮箱",
        data={"new_email": req.new_email},
    )


@router.post("/me/email/change-confirm")
async def email_change_confirm(
    req: EmailChangeConfirmRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """验证并更新邮箱。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException(ERR_USER_NOT_FOUND)

    # 校验验证码
    if not user.email_verify_code_hash:
        raise ValidationException("请先发送验证码")
    if not user.email_verify_expires_at or user.email_verify_expires_at < datetime.now(timezone.utc):
        raise ValidationException(ERR_VERIFY_CODE_EXPIRED_RESEND)
    if not bcrypt.checkpw(req.code.encode("utf-8"), user.email_verify_code_hash.encode("utf-8")):
        raise ValidationException(ERR_VERIFY_CODE_INVALID)

    # 再次检查邮箱是否被占用
    result = await db.execute(
        select(User).where(User.email == req.new_email, User.id != current_user["id"])
    )
    if result.scalar_one_or_none():
        raise ValidationException("该邮箱已被其他用户使用")

    user.email = req.new_email
    user.email_verified = True
    user.email_verify_code_hash = None
    user.email_verify_expires_at = None
    await db.commit()

    # 审计：邮箱变更（安全敏感操作）
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["EMAIL_CHANGE"],
        action_detail={"new_email": req.new_email},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return success_response(message="邮箱更新成功")


@router.post("/me/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传头像（base64 存储）。"""
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
    MAX_SIZE = 2 * 1024 * 1024  # 2MB

    if file.content_type not in ALLOWED_TYPES:
        raise ValidationException("仅支持 jpg/png/webp 格式")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise ValidationException("文件大小不能超过 2MB")

    # 校验文件头魔数：防止伪装成图片的恶意文件（content_type 头可被客户端伪造）
    _validate_image_magic(content)

    # 转为 base64 data URI
    b64 = base64.b64encode(content).decode("utf-8")
    avatar_url = f"data:{file.content_type};base64,{b64}"

    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException(ERR_USER_NOT_FOUND)
    user.avatar = avatar_url
    await db.commit()

    # 审计：头像变更
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["AVATAR_UPDATE"],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return success_response(data={"avatar": avatar_url})


def _validate_image_magic(content: bytes) -> None:
    """校验图片文件头魔数，仅接受 jpg / png / webp。

    Args:
        content: 文件二进制内容

    Raises:
        ValidationException: 文件头与声明格式不符
    """
    if len(content) < 12:
        raise ValidationException("文件内容过短，不是有效图片")

    if content[:3] == b"\xff\xd8\xff":  # JPEG
        return
    if content[:8] == b"\x89PNG\r\n\x1a\n":  # PNG
        return
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":  # WebP
        return

    raise ValidationException("文件内容与声明格式不符，仅支持 jpg/png/webp")
