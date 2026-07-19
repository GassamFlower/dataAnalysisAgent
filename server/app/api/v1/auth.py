"""认证相关 API。"""
import hashlib
import re
import uuid
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote_plus

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import UnauthorizedException, ValidationException
from app.core.responses import success_response
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["认证"])

# 测试账号固定用户（与 dependencies.py 保持一致）
TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _hash_refresh_token(token: str) -> str:
    """对 refresh token 做 SHA256 哈希后入库。"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _issue_tokens(user: User, db: AsyncSession) -> dict:
    """签发双 token 并将 refresh token 哈希写入用户表。"""
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    user.refresh_token = _hash_refresh_token(refresh_token)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "nickname": user.nickname,
            "avatar": user.avatar,
            "email": user.email,
            "plan": user.plan,
        },
    }


@router.post("/dev-login")
async def dev_login(db: AsyncSession = Depends(get_db)):
    """测试账号登录，返回双 token。

    该端点仅在 DEBUG=True 时可用，生产环境必须禁用。
    """
    if not settings.DEBUG:
        raise UnauthorizedException("测试账号登录仅在开发环境可用")

    # 获取或创建测试用户
    user = await db.get(User, TEST_USER_ID)
    if not user:
        user = User(
            id=TEST_USER_ID,
            openid="dev-openid",
            nickname="测试用户",
            plan="subscription",
        )
        db.add(user)
        await db.flush()

    tokens = await _issue_tokens(user, db)
    return success_response(data=tokens)


# ---------------------------------------------------------------------------
# 微信公众号网页授权
# ---------------------------------------------------------------------------

class WechatLoginUrlResponse(BaseModel):
    """微信授权链接响应。"""
    url: str


@router.get("/wechat/login-url")
async def wechat_login_url(
    redirect: str = Query(default="/projects", description="登录成功后前端跳转路径"),
):
    """返回微信网页授权链接，前端跳转到此 URL 让用户扫码/授权。

    流程：前端 GET /api/v1/auth/wechat/login-url?redirect=/xxx → 拿到 url → 跳转 →
    微信回调到 WECHAT_REDIRECT_URI?code=xxx&state=xxx → 前端 BFF 回调路由转发到 /wechat/callback
    """
    if not settings.WECHAT_APP_ID or not settings.WECHAT_REDIRECT_URI:
        raise ValidationException("微信登录未配置，请在 .env 中设置 WECHAT_APP_ID / WECHAT_REDIRECT_URI")

    # state 用于传递登录成功后的前端跳转路径（URL 编码防注入）
    state = quote_plus(redirect)

    url = (
        f"https://open.weixin.qq.com/connect/oauth2/authorize"
        f"?appid={settings.WECHAT_APP_ID}"
        f"&redirect_uri={quote_plus(settings.WECHAT_REDIRECT_URI)}"
        f"&response_type=code"
        f"&scope=snsapi_userinfo"
        f"&state={state}"
        f"#wechat_redirect"
    )

    return success_response(data=WechatLoginUrlResponse(url=url).model_dump())


class WechatCallbackRequest(BaseModel):
    """微信回调请求体。"""
    code: str


@router.post("/wechat/callback")
async def wechat_callback(
    req: WechatCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """微信授权回调：code → openid → upsert User → 签发 JWT。

    前端 BFF 回调路由从 URL query 拿到 code，POST 到此端点交换 JWT。
    """
    if not settings.WECHAT_APP_ID or not settings.WECHAT_APP_SECRET:
        raise ValidationException("微信登录未配置，请在 .env 中设置 WECHAT_APP_ID / WECHAT_APP_SECRET")

    # 1. code → access_token + openid
    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.get(
            "https://api.weixin.qq.com/sns/oauth2/access_token",
            params={
                "appid": settings.WECHAT_APP_ID,
                "secret": settings.WECHAT_APP_SECRET,
                "code": req.code,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_resp.json()

    if "errcode" in token_data and token_data["errcode"] != 0:
        raise UnauthorizedException(f"微信授权失败: {token_data.get('errmsg', 'unknown error')}")

    access_token = token_data.get("access_token")
    openid = token_data.get("openid")
    if not access_token or not openid:
        raise UnauthorizedException("微信授权失败: 未获取到 access_token 或 openid")

    # 2. access_token + openid → 用户信息（昵称、头像）
    nickname = "微信用户"
    avatar = None
    async with httpx.AsyncClient(timeout=10) as client:
        userinfo_resp = await client.get(
            "https://api.weixin.qq.com/sns/userinfo",
            params={
                "access_token": access_token,
                "openid": openid,
                "lang": "zh_CN",
            },
        )
        userinfo_data = userinfo_resp.json()

    if "errcode" not in userinfo_data or userinfo_data.get("errcode") == 0:
        nickname = userinfo_data.get("nickname", "微信用户")
        avatar = userinfo_data.get("headimgurl")

    # 3. upsert User（openid 唯一）
    result = await db.execute(select(User).where(User.openid == openid))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            openid=openid,
            nickname=nickname,
            avatar=avatar,
            plan="free",
        )
        db.add(user)
        await db.flush()
    else:
        # 更新昵称头像（用户可能改过）
        if nickname and nickname != "微信用户":
            user.nickname = nickname
        if avatar:
            user.avatar = avatar

    # 4. 签发双 token
    tokens = await _issue_tokens(user, db)
    return success_response(data=tokens)


# ---------------------------------------------------------------------------
# 邮箱注册与登录
# ---------------------------------------------------------------------------

# 密码重置 JWT 的专用密钥（与登录 JWT 分开，避免误用）
RESET_TOKEN_TYPE = "password_reset"


def _generate_code(length: int = 6) -> str:
    """生成随机数字验证码。"""
    return "".join(random.choices(string.digits, k=length))


def _hash_email_verification_code(code: str) -> str:
    """对邮箱验证码做 bcrypt 哈希后入库。"""
    return bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_email_verification_code(code: str, hashed: str) -> bool:
    """校验邮箱验证码与数据库哈希是否匹配。"""
    try:
        return bcrypt.checkpw(code.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_reset_token(user_id: uuid.UUID) -> str:
    """生成密码重置 JWT token（30 分钟有效）。

    使用独立的 RESET_JWT_SECRET_KEY，避免与登录 JWT 共用密钥。
    """
    payload = {
        "sub": str(user_id),
        "type": RESET_TOKEN_TYPE,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.RESET_JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _verify_reset_token(token: str) -> Optional[uuid.UUID]:
    """验证密码重置 token，返回 user_id 或 None。"""
    try:
        payload = jwt.decode(token, settings.RESET_JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != RESET_TOKEN_TYPE:
            return None
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError):
        return None


class RegisterRequest(BaseModel):
    """邮箱注册请求。"""
    email: str
    password: str  # 6~32 位
    nickname: str = ""

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower()


class VerifyEmailRequest(BaseModel):
    """邮箱验证请求。"""
    email: str
    code: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower()


class EmailLoginRequest(BaseModel):
    """邮箱登录请求。"""
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower()


class ForgotPasswordRequest(BaseModel):
    """忘记密码请求。"""
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower()


class ResetPasswordRequest(BaseModel):
    """重置密码请求。"""
    token: str
    new_password: str


@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """邮箱注册：创建用户 → 发送验证码邮件。

    注册后用户 email_verified=False，需调用 /verify-email 验证后才能登录。
    邮件发送失败不影响用户创建，用户可调用 /resend-code 重新获取验证码。
    """
    # 密码长度校验
    if len(req.password) < 6 or len(req.password) > 32:
        raise ValidationException("密码长度需在 6~32 位之间")

    # 检查邮箱是否已注册
    result = await db.execute(select(User).where(User.email == req.email))
    existing_user = result.scalar_one_or_none()

    from app.core.security import hash_password

    if existing_user:
        if existing_user.email_verified:
            raise ValidationException("该邮箱已注册")
        # 已注册但未验证：更新密码、昵称和验证码，重新发送
        user = existing_user
        user.password_hash = hash_password(req.password)
        if req.nickname:
            user.nickname = req.nickname
    else:
        # 创建用户（email_verified=False）
        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            nickname=req.nickname or req.email.split("@")[0],
            plan="free",
            email_verified=False,
        )
        db.add(user)
        await db.flush()

    # 生成验证码并存储哈希（禁止明文入库）
    code = _generate_code()
    user.email_verify_code_hash = _hash_email_verification_code(code)
    user.email_verify_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    # 先提交用户数据（确保即使邮件发送失败用户也已创建）
    await db.commit()

    # 发送验证码邮件（失败不影响用户创建）
    from app.services.email_service import send_verification_code
    try:
        await send_verification_code(req.email, code)
    except Exception as e:
        return success_response(
            message=f"注册成功但验证码邮件发送失败: {e}，请稍后重试发送验证码"
        )

    return success_response(message="注册成功，请查收邮箱并输入验证码完成验证")


@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """验证邮箱：校验验证码 → 标记 email_verified=True → 签发 JWT。"""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise ValidationException("该邮箱未注册")

    if user.email_verified:
        raise ValidationException("邮箱已验证，无需重复验证")

    if not user.email_verify_code_hash or not user.email_verify_expires_at:
        raise ValidationException("请先获取验证码")

    if datetime.now(timezone.utc) > user.email_verify_expires_at:
        raise ValidationException("验证码已过期，请重新获取")

    if not _verify_email_verification_code(req.code, user.email_verify_code_hash):
        raise ValidationException("验证码错误")

    # 验证成功
    user.email_verified = True
    user.email_verify_code_hash = None
    user.email_verify_expires_at = None

    tokens = await _issue_tokens(user, db)
    return success_response(data=tokens)


class ResendCodeRequest(BaseModel):
    """重新发送验证码请求。"""
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower()


@router.post("/resend-code")
async def resend_code(req: ResendCodeRequest, db: AsyncSession = Depends(get_db)):
    """重新发送邮箱验证码。"""
    from app.services.email_service import send_verification_code

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise ValidationException("该邮箱未注册")
    if user.email_verified:
        raise ValidationException("邮箱已验证，无需重复验证")

    code = _generate_code()
    user.email_verify_code_hash = _hash_email_verification_code(code)
    user.email_verify_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    try:
        await send_verification_code(req.email, code)
    except Exception as e:
        raise ValidationException(f"验证码邮件发送失败: {e}")

    return success_response(message="验证码已重新发送")


@router.post("/email-login")
async def email_login(req: EmailLoginRequest, db: AsyncSession = Depends(get_db)):
    """邮箱登录：校验邮箱+密码 → 签发 JWT。"""
    from app.core.security import verify_password

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise UnauthorizedException("邮箱或密码错误")

    if not verify_password(req.password, user.password_hash):
        raise UnauthorizedException("邮箱或密码错误")

    if not user.email_verified:
        raise ValidationException("邮箱未验证，请先完成邮箱验证")

    tokens = await _issue_tokens(user, db)
    return success_response(data=tokens)


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """忘记密码：生成重置链接 → 发送邮件。

    出于安全考虑，即使邮箱不存在也返回成功（防止枚举攻击）。
    """
    from app.services.email_service import send_password_reset_email

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if user and user.email_verified:
        token = _create_reset_token(user.id)
        reset_link = f"{settings.FRONTEND_BASE_URL}/reset-password?token={token}"
        try:
            await send_password_reset_email(req.email, reset_link)
        except Exception:
            # 邮件发送失败不暴露给用户
            pass

    return success_response(message="如果该邮箱已注册，您将收到一封密码重置邮件")


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """重置密码：验证 token → 更新密码。"""
    from app.core.security import hash_password

    if len(req.new_password) < 6 or len(req.new_password) > 32:
        raise ValidationException("密码长度需在 6~32 位之间")

    user_id = _verify_reset_token(req.token)
    if not user_id:
        raise ValidationException("重置链接无效或已过期，请重新申请")

    user = await db.get(User, user_id)
    if not user:
        raise ValidationException("用户不存在")

    user.password_hash = hash_password(req.new_password)

    return success_response(message="密码重置成功，请使用新密码登录")


class RefreshRequest(BaseModel):
    """刷新 token 请求。"""
    refresh_token: str


@router.post("/refresh")
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """使用 refresh token 换发新的双 token。"""
    payload = verify_token(req.refresh_token, expected_type="refresh")
    if not payload:
        raise UnauthorizedException("refresh token 无效或已过期")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise UnauthorizedException("refresh token 无效")

    user = await db.get(User, user_id)
    if not user or not user.refresh_token:
        raise UnauthorizedException("用户不存在或已登出")

    if user.refresh_token != _hash_refresh_token(req.refresh_token):
        raise UnauthorizedException("refresh token 无效")

    tokens = await _issue_tokens(user, db)
    return success_response(data=tokens)


@router.post("/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """退出登录：清空用户表中存储的 refresh token 哈希，使当前 refresh token 失效。"""
    user = await db.get(User, current_user["id"])
    if user:
        user.refresh_token = None
        await db.commit()
    return success_response(message="已退出登录")
