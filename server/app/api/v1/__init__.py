"""v1 版路由聚合。"""
from fastapi import APIRouter

from app.api.v1 import auth, payment, projects, questionnaire, report, simulation, users

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(projects.router)
router.include_router(questionnaire.router)
router.include_router(simulation.router)
router.include_router(report.router)
router.include_router(payment.router)
router.include_router(users.router)
