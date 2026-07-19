"""用户个人中心 API。"""
import asyncio
import base64
import hashlib
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ValidationException
from app.core.responses import success_response
from app.core.security import hash_password, verify_password
from app.models.user import User

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
        raise ValidationException("用户不存在")
    return success_response(data=_user_dict(user))


@router.patch("/me/profile")
async def update_profile(
    req: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改昵称。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException("用户不存在")
    user.nickname = req.nickname
    await db.commit()
    return success_response(data={"nickname": user.nickname})


@router.patch("/me/password")
async def update_password(
    req: PasswordUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改密码（需校验旧密码）。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException("用户不存在")
    if not user.password_hash:
        raise ValidationException("当前账号未设置密码")
    if not verify_password(req.old_password, user.password_hash):
        raise ValidationException("旧密码不正确")
    user.password_hash = hash_password(req.new_password)
    await db.commit()
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
        raise ValidationException("用户不存在")

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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """验证并更新邮箱。"""
    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException("用户不存在")

    # 校验验证码
    if not user.email_verify_code_hash:
        raise ValidationException("请先发送验证码")
    if not user.email_verify_expires_at or user.email_verify_expires_at < datetime.now(timezone.utc):
        raise ValidationException("验证码已过期，请重新发送")
    if not bcrypt.checkpw(req.code.encode("utf-8"), user.email_verify_code_hash.encode("utf-8")):
        raise ValidationException("验证码不正确")

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

    return success_response(message="邮箱更新成功")


@router.post("/me/avatar")
async def upload_avatar(
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

    # 转为 base64 data URI
    b64 = base64.b64encode(content).decode("utf-8")
    avatar_url = f"data:{file.content_type};base64,{b64}"

    user = await db.get(User, current_user["id"])
    if not user:
        raise ValidationException("用户不存在")
    user.avatar = avatar_url
    await db.commit()

    return success_response(data={"avatar": avatar_url})
