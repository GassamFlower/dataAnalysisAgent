"""认证相关 API。"""
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.core.responses import success_response
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["认证"])

# 开发模式固定用户（与 dependencies.py 保持一致）
DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.post("/dev-login")
async def dev_login(db: AsyncSession = Depends(get_db)):
    """开发模式登录，返回 JWT。
    
    生产环境应禁用此端点，改用真实认证（如微信扫码）。
    """
    if not settings.DEBUG:
        return success_response(code=40300, message="生产环境禁用开发登录")
    
    # 获取或创建开发用户
    user = await db.get(User, DEV_USER_ID)
    if not user:
        user = User(
            id=DEV_USER_ID,
            openid="dev-openid",
            nickname="开发者",
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
