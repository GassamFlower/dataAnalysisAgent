"""前端公开配置路由（无需登录）。

供营销/售后入口读取除敏感信息之外的运行配置，避免在前端硬编码。
当前仅暴露客服微信号占位（Task 2.3）：留空即占位态，填入真实号后
前端只读该值即切换为"可复制真实号"形态，不再散落硬编码。

⚠️ 注意：这里只允许返回非敏感配置，严禁暴露任何密钥。
"""
from fastapi import APIRouter

from app.core.config import settings
from app.core.responses import success_response

router = APIRouter(prefix="/frontend", tags=["前端公开配置"])


@router.get("/config")
async def get_frontend_config():
    """返回前端非敏感运行配置。"""
    return success_response(
        data={
            "customer_service_wechat_id": settings.CUSTOMER_SERVICE_WECHAT_ID,
        }
    )