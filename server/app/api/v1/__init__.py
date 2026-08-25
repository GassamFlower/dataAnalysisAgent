"""v1 版路由聚合。"""
from fastapi import APIRouter

from app.api.v1 import auth, compliance, dataset, llm_config, payment, projects, questionnaire, report, simulation, tutorial, users, analytics, admin, message, frontend_config, scales

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(projects.router)
router.include_router(questionnaire.router)
router.include_router(dataset.router)
router.include_router(simulation.router)
router.include_router(report.router)
router.include_router(payment.router)
router.include_router(users.router)
router.include_router(compliance.router)
router.include_router(llm_config.router)
router.include_router(tutorial.router)
router.include_router(analytics.router)
router.include_router(admin.router)
router.include_router(message.router)
router.include_router(frontend_config.router)
router.include_router(scales.router)
