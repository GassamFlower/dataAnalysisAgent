"""认证相关 API。"""
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token
from app.core.responses import success_response
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
