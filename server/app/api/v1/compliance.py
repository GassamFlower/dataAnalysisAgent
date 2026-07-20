"""合规相关 API（协议同意、承诺确认等）。"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.responses import success_response
from app.services.agreement_service import AgreementService, AGREEMENT_VERSIONS

router = APIRouter(prefix="/compliance", tags=["合规"])


# ── Schemas ──────────────────────────────────────────────


class SimulationDisclaimerCheckResponse(BaseModel):
    """模拟数据承诺检查响应。"""
    has_agreed: bool
    agreement_version: str


class SimulationDisclaimerConfirmRequest(BaseModel):
    """模拟数据承诺确认请求。"""
    pass  # 无需额外参数


# ── Routes ───────────────────────────────────────────────


@router.get("/simulation-disclaimer/check")
async def check_simulation_disclaimer(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """检查用户是否已同意模拟数据承诺。"""
    version = AGREEMENT_VERSIONS["simulation_disclaimer"]
    has_agreed = await AgreementService.has_agreed(
        db,
        user_id=current_user["id"],
        agreement_type="simulation_disclaimer",
        agreement_version=version,
    )
    return success_response(
        data=SimulationDisclaimerCheckResponse(
            has_agreed=has_agreed,
            agreement_version=version,
        )
    )


@router.post("/simulation-disclaimer/confirm")
async def confirm_simulation_disclaimer(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """记录用户同意模拟数据承诺。"""
    version = AGREEMENT_VERSIONS["simulation_disclaimer"]
    
    # 获取客户端信息用于审计
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")
    
    await AgreementService.record_agreement(
        db=db,
        user_id=current_user["id"],
        agreement_type="simulation_disclaimer",
        agreement_version=version,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    
    return success_response(data={"message": "已确认模拟数据承诺"})


@router.get("/agreements/status")
async def get_agreements_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户所有协议同意状态。"""
    agreements = await AgreementService.get_user_agreements(db, current_user["id"])
    
    status = {}
    for agreement in agreements:
        status[agreement.agreement_type] = {
            "version": agreement.agreement_version,
            "agreed_at": agreement.agreed_at.isoformat() if agreement.agreed_at else None,
        }
    
    return success_response(data={"agreements": status})
