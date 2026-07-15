"""认证相关 API。"""
import uuid
from urllib.parse import quote_plus

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import UnauthorizedException, ValidationException
from app.core.responses import success_response
from app.core.security import create_access_token
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["认证"])

# 测试账号固定用户（与 dependencies.py 保持一致）
TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.post("/dev-login")
async def dev_login(db: AsyncSession = Depends(get_db)):
    """测试账号登录，返回 JWT。

    该端点仅通过 BFF 层（/api/auth/login）暴露，不直接对外。
    生产环境接入真实认证（如微信扫码）后应移除此端点。
    """
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

    # 生成 JWT
    token = create_access_token(user.id)

    return success_response(data={
        "token": token,
        "user": {
            "id": str(user.id),
            "nickname": user.nickname,
            "plan": user.plan,
        }
    })


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

    # 4. 签发 JWT
    token = create_access_token(user.id)

    return success_response(data={
        "token": token,
        "user": {
            "id": str(user.id),
            "nickname": user.nickname,
            "avatar": user.avatar,
            "plan": user.plan,
        }
    })
