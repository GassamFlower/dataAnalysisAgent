"""报告路由：统计分析 + R4 诊断 + 差异检验 + 导出。"""
from typing import Any, Dict, List, Optional
from uuid import UUID

import pandas as pd
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.responses import ResponseModel
from app.core.exceptions import NotFoundException, ValidationException
from app.models.report import Report
from app.models.reliability_result import ReliabilityResult
from app.models.diagnosis import Diagnosis
from app.models.diagnosis_issue import DiagnosisIssue
from app.models.question import Question
from app.models.simulation_config import SimulationConfig
from app.schemas.report import ReportResponse, DiffTestResultResponse, ExportRequest
from app.services.project_service import get_owned_project, update_project_status
from app.services.quota_service import check_and_consume_quota
from app.services.audit_service import AuditService, ACTION_TYPES

router = APIRouter(prefix="/report", tags=["report"])


async def _load_dataset_df(
    db: AsyncSession, project_id: UUID
) -> Optional[pd.DataFrame]:
    """加载项目最新数据集为 DataFrame。"""
    from app.models.dataset import Dataset
    result = await db.execute(
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        return None
    return pd.DataFrame(dataset.data, columns=dataset.columns)


async def _compute_diff_tests(
    db: AsyncSession, project_id: UUID, df: pd.DataFrame
) -> List[Dict[str, Any]]:
    """读取项目假设路径并执行差异检验（不落库，实时计算）。

    对应后端架构文档 9.6 节决策树。无假设路径时返回空列表。
    """
    from app.models.hypothesis import Hypothesis
    from app.models.hypothesis_path import HypothesisPath
    from app.services.diff_test import run_diff_tests

    result = await db.execute(
        select(HypothesisPath)
        .join(Hypothesis, HypothesisPath.hypothesis_id == Hypothesis.id)
        .where(Hypothesis.project_id == project_id)
    )
    paths = result.scalars().all()
    if not paths:
        return []

    paths_data = [
        {
            "predictor": p.predictor,
            "outcome": p.outcome,
            "direction": p.direction,
            "strength": p.strength,
        }
        for p in paths
    ]
    return run_diff_tests(df, paths_data)


def _build_report_response(
    report: Report, diff_tests: List[Dict[str, Any]], sample_size: Optional[int] = None
) -> ReportResponse:
    """构造报告响应，注入实时计算的差异检验结果和样本量。"""
    response = ReportResponse.model_validate(report)
    response.diff_tests = [DiffTestResultResponse(**d) for d in diff_tests]
    response.sample_size = sample_size
    return response


async def _get_sample_size(db: AsyncSession, project_id: UUID) -> Optional[int]:
    """从 SimulationConfig 查询样本量（不落库到 Report，实时注入）。"""
    result = await db.execute(
        select(SimulationConfig.sample_size)
        .where(SimulationConfig.project_id == project_id)
        .order_by(SimulationConfig.created_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row


@router.get(
    "/{project_id}",
    response_model=ResponseModel[ReportResponse],
    summary="获取报告",
    description="按项目 ID 查询最新已存报告。查询为免费能力。差异检验结果实时计算，不落库。"
)
async def get_report(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """按项目 ID 查询最新已存报告（含信效度结果、R4 诊断、差异检验）。"""
    # 1. 验证项目归属（含软删除过滤）
    await get_owned_project(db, project_id, current_user["id"])

    # 2. 查询最新报告（selectinload 关联数据）
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Report)
        .options(
            selectinload(Report.reliability_results),
            selectinload(Report.diagnosis).selectinload(Diagnosis.issues)
        )
        .where(Report.project_id == project_id)
        .order_by(Report.created_at.desc())
        .limit(1)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundException("未找到报告，请先完成分析")

    # 3. 实时计算差异检验（不落库）
    diff_tests: List[Dict[str, Any]] = []
    df = await _load_dataset_df(db, project_id)
    if df is not None:
        diff_tests = await _compute_diff_tests(db, project_id, df)

    # 4. 查询样本量（从 SimulationConfig 实时注入，不落库到 Report）
    sample_size = await _get_sample_size(db, project_id)

    return ResponseModel(data=_build_report_response(report, diff_tests, sample_size))


@router.post(
    "/analyze/{project_id}",
    response_model=ResponseModel[ReportResponse],
    summary="生成报告",
    description="跑标准统计套餐 + R4 诊断结论。付费能力。"
)
async def analyze(
    project_id: UUID,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """跑标准统计套餐 + R4 诊断结论。"""
    # 0. 校验并扣减免费额度
    await check_and_consume_quota(db, current_user["id"], "analysis", current_user["plan"])

    # 1. 验证项目存在且属于当前用户（含软删除过滤）
    project = await get_owned_project(db, project_id, current_user["id"])

    # 2. 验证项目状态为 simulated
    if project.status != "simulated":
        raise ValidationException("项目状态不正确，请先完成数据生成")

    # 3. 获取最新模拟配置
    result = await db.execute(
        select(SimulationConfig)
        .where(SimulationConfig.project_id == project_id)
        .order_by(SimulationConfig.created_at.desc())
        .limit(1)
    )
    sim_config = result.scalar_one_or_none()
    if not sim_config:
        raise NotFoundException("未找到模拟配置")

    # 4. 获取维度列表
    result = await db.execute(
        select(Question.dimension)
        .where(Question.project_id == project_id)
        .distinct()
    )
    dimensions = [row[0] for row in result.all() if row[0]]

    # 5. 获取题目-维度映射
    result = await db.execute(
        select(Question).where(Question.project_id == project_id)
    )
    questions = result.scalars().all()
    dimension_items = {}
    for q in questions:
        if q.dimension not in dimension_items:
            dimension_items[q.dimension] = []
        dimension_items[q.dimension].append(f"q{q.index}")

    # 6. 读取生成的数据集（来自 /generate 端点）
    from app.models.dataset import Dataset
    result = await db.execute(
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise NotFoundException("未找到模拟数据集，请先生成数据")

    import pandas as pd
    import numpy as np
    dim_df = pd.DataFrame(dataset.data, columns=dataset.columns)

    # 7. 展开维度级数据为题目级数据（同维度多题 = 维度值 + 小扰动，保留维度间相关结构）
    rng = np.random.default_rng(42)
    data = {}
    for dim, items in dimension_items.items():
        if dim in dim_df.columns:
            base = dim_df[dim].values
            for item in items:
                # 题目值 = 维度均值 + 小扰动，clip 到李克特量表范围 [1, 5]
                noise = rng.normal(0, 0.5, size=len(base))
                data[item] = np.clip(np.round(base + noise), 1, 5).astype(int)
        else:
            # 兜底：维度缺失时用维度均值基线生成
            base = dim_df.iloc[:, 0].values if not dim_df.empty else np.ones(sim_config.sample_size) * 3
            for item in items:
                data[item] = rng.integers(1, 6, size=len(base))
    df = pd.DataFrame(data)

    # 8. 调用统计分析服务
    from app.services.stats import analyze_reliability
    reliability_results = analyze_reliability(df, dimensions, dimension_items)

    # 8b. 计算差异检验（不落库，按假设路径实时计算，对应架构文档 9.6）
    #     提前计算以便诊断时检测回归翻车点（R11~R14）
    diff_tests = await _compute_diff_tests(db, project_id, dim_df)

    # 9. 调用诊断服务（传入 project_meta 供信效度翻车点匹配，传入 diff_tests 供回归翻车点匹配）
    from app.services.diagnoser import diagnose
    project_meta = {
        "sample_size": sim_config.sample_size,
        "dimension_count": len(dimensions),
        "has_reverse_items": any(getattr(q, "is_reverse", False) for q in questions),
        "reverse_scored": False,  # 当前模拟数据路径未做反向计分
    }
    diagnosis_result = diagnose(
        reliability_results, project_meta, diff_tests=diff_tests
    )

    # 10. 保存报告
    overall_alpha = sum(r["alpha"] for r in reliability_results) / len(reliability_results) if reliability_results else 0
    passed_count = sum(1 for r in reliability_results if r["passed"])

    report = Report(
        project_id=project_id,
        overall_alpha=overall_alpha,
        passed_count=passed_count,
        total_count=len(reliability_results)
    )
    db.add(report)
    await db.flush()

    # 11. 保存信效度结果
    for r in reliability_results:
        reliability_result = ReliabilityResult(
            report_id=report.id,
            dimension=r["dimension"],
            alpha=r["alpha"],
            kmo=r["kmo"],
            bartlett_p_value=r["bartlett_p_value"],
            passed=r["passed"]
        )
        db.add(reliability_result)

    # 12. 保存诊断结果
    diagnosis = Diagnosis(
        report_id=report.id,
        passed=diagnosis_result["passed"]
    )
    db.add(diagnosis)
    await db.flush()

    for issue in diagnosis_result.get("issues", []):
        # 规则级翻车点（如反向题未反转）不绑定具体数值，value/threshold 为 None；
        # DB 字段 NOT NULL，此处统一兜底为 0（metric/reason 文本已说明性质）
        raw_value = issue.get("value")
        raw_threshold = issue.get("threshold")
        try:
            issue_value = float(raw_value) if raw_value is not None else 0.0
        except (TypeError, ValueError):
            issue_value = 0.0
        try:
            issue_threshold = float(raw_threshold) if raw_threshold is not None else 0.0
        except (TypeError, ValueError):
            issue_threshold = 0.0
        diagnosis_issue = DiagnosisIssue(
            diagnosis_id=diagnosis.id,
            dimension=issue.get("dimension", "") or "",
            metric=issue.get("metric", "") or "",
            value=issue_value,
            threshold=issue_threshold,
            reason=issue.get("reason", "") or "",
            suggestion=issue.get("suggestion", "") or "",
        )
        db.add(diagnosis_issue)

    # 13. 更新项目状态
    update_project_status(project, "analyzed", reason="报告分析完成")

    # 13.5 记录审计日志
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["ANALYSIS_RUN"],
        project_id=project_id,
        action_detail={
            "overall_alpha": overall_alpha,
            "passed_count": passed_count,
            "total_count": len(reliability_results),
            "diagnosis_passed": diagnosis_result["passed"],
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )

    await db.flush()

    # 14. 返回报告 + 差异检验（diff_tests 已在步骤 8b 计算，显式加载关系）
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Report)
        .options(
            selectinload(Report.reliability_results),
            selectinload(Report.diagnosis).selectinload(Diagnosis.issues)
        )
        .where(Report.id == report.id)
    )
    report = result.scalar_one()

    # 查询样本量（与 get_report 保持一致）
    sample_size = await _get_sample_size(db, project_id)

    return ResponseModel(data=_build_report_response(report, diff_tests, sample_size))


@router.post(
    "/export/{report_id}",
    summary="导出报告",
    description="导出报告（word / excel），含 simulated 水印。"
)
async def export(
    report_id: UUID,
    request: ExportRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """导出报告（word / excel），含 simulated 水印。"""
    # 0. 校验并扣减免费额度
    await check_and_consume_quota(db, current_user["id"], "export", current_user["plan"])

    # 1. 加载报告及关联数据
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Report)
        .options(
            selectinload(Report.reliability_results),
            selectinload(Report.diagnosis).selectinload(Diagnosis.issues)
        )
        .where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundException("报告不存在")

    # 2. 验证项目归属（含软删除过滤）
    project = await get_owned_project(db, report.project_id, current_user["id"])

    # 2.5 记录审计日志
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["REPORT_EXPORT"],
        project_id=report.project_id,
        action_detail={
            "report_id": str(report_id),
            "format": request.format,
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )

    # 3. 实时计算差异检验（不落库，与 get_report/analyze 保持一致）
    diff_tests: List[Dict[str, Any]] = []
    df = await _load_dataset_df(db, report.project_id)
    if df is not None:
        diff_tests = await _compute_diff_tests(db, report.project_id, df)

    # 4. 转换为字典
    report_data = {
        "project_id": str(report.project_id),
        "overall_alpha": str(report.overall_alpha) if report.overall_alpha else "0",
        "passed_count": report.passed_count or 0,
        "total_count": report.total_count or 0,
        "reliability_results": [
            {
                "dimension": r.dimension,
                "alpha": str(r.alpha),
                "kmo": str(r.kmo),
                "bartlett_p_value": str(r.bartlett_p_value),
                "passed": r.passed
            }
            for r in report.reliability_results
        ],
        "diagnosis": {
            "passed": report.diagnosis.passed,
            "issues": [
                {
                    "dimension": issue.dimension,
                    "metric": issue.metric,
                    "value": str(issue.value),
                    "threshold": str(issue.threshold),
                    "reason": issue.reason,
                    "suggestion": issue.suggestion
                }
                for issue in report.diagnosis.issues
            ] if report.diagnosis else []
        } if report.diagnosis else None,
        "diff_tests": diff_tests,
    }

    # 5. 调用导出服务
    from app.services.reporter import export_word, export_excel

    # 合规：模拟数据或用户声明模拟数据时，文件名强制包含 simulated 标识
    is_simulated = project.mode == "simulation" or request.data_source == "simulated"
    suffix = "simulated" if is_simulated else "real"

    if request.format == "word":
        file_bytes = export_word(report_data)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"report_{report_id}_{suffix}.docx"
    elif request.format == "excel":
        file_bytes = export_excel(report_data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"report_{report_id}_{suffix}.xlsx"
    else:
        raise ValidationException("不支持的导出格式")

    # 6. 返回文件
    return StreamingResponse(
        iter([file_bytes]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
