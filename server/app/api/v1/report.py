"""报告路由：统计分析 + R4 诊断 + 差异检验 + 导出。"""
import time
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
from app.core.error_messages import ERR_DATASET_NOT_FOUND, ERR_REPORT_NOT_FOUND, ERR_UNSUPPORTED_FORMAT
from app.models.report import Report
from app.models.reliability_result import ReliabilityResult
from app.models.diagnosis import Diagnosis
from app.models.diagnosis_issue import DiagnosisIssue
from app.models.question import Question
from app.models.simulation_config import SimulationConfig
from app.schemas.report import ReportResponse, DiffTestResultResponse, ExportRequest, PolishRequest, PolishResponse, SampleRepresentativenessResponse, SampleSizePlannerRequest, SampleSizePlannerResponse
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

    # 注入「一句话结论」：每个诊断问题配一句怎么办（确定性模板，不落库）
    from app.services.diagnosis_rules import one_liner_for
    if response.diagnosis:
        for issue in response.diagnosis.issues:
            issue.one_liner = one_liner_for(
                issue.metric, issue.value, issue.threshold
            )
    return response


async def _get_sample_size(db: AsyncSession, project_id: UUID) -> Optional[int]:
    """查询样本量（不落库到 Report，实时注入）。

    真实数据项目从最新 Dataset 读取；模拟数据项目从 SimulationConfig 读取。
    """
    from app.models.dataset import Dataset
    result = await db.execute(
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()
    if dataset and dataset.source == "real":
        return dataset.sample_size

    result = await db.execute(
        select(SimulationConfig.sample_size)
        .where(SimulationConfig.project_id == project_id)
        .order_by(SimulationConfig.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _load_report_with_relations(
    db: AsyncSession, report_id: UUID
) -> Optional[Report]:
    """加载报告及其关联数据（信效度结果、R4 诊断、诊断明细）。"""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Report)
        .options(
            selectinload(Report.reliability_results),
            selectinload(Report.diagnosis).selectinload(Diagnosis.issues)
        )
        .where(Report.id == report_id)
    )
    return result.scalar_one_or_none()


def _build_report_data(
    report: Report, diff_tests: List[Dict[str, Any]], *, as_str: bool = False
) -> Dict[str, Any]:
    """构建报告数据字典，供导出 / 润色共用。

    export 用 as_str=True（导出的数值需字符串化便于排版）；
    polish 用 as_str=False（LLM 读取需数值类型）。避免两份几乎相同的 dict 重复维护。
    """
    def _fmt(v: Any) -> Any:
        """按 as_str 标志格式化数值。"""
        if v is None:
            return "0" if as_str else 0.0
        return str(v) if as_str else float(v)

    return {
        "project_id": str(report.project_id),
        "overall_alpha": _fmt(report.overall_alpha),
        "passed_count": report.passed_count or 0,
        "total_count": report.total_count or 0,
        "reliability_results": [
            {
                "dimension": r.dimension,
                "alpha": _fmt(r.alpha),
                "kmo": _fmt(r.kmo),
                "bartlett_p_value": _fmt(r.bartlett_p_value),
                "passed": r.passed
            }
            for r in report.reliability_results
        ],
        "diagnosis": (
            {
                "passed": report.diagnosis.passed,
                "issues": [
                    {
                        "dimension": issue.dimension,
                        "metric": issue.metric,
                        "value": _fmt(issue.value),
                        "threshold": _fmt(issue.threshold),
                        "reason": issue.reason,
                        "suggestion": issue.suggestion
                    }
                    for issue in report.diagnosis.issues
                ]
            }
            if report.diagnosis
            else None
        ),
        "diff_tests": diff_tests,
    }


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
    await check_and_consume_quota(
        db,
        current_user["id"],
        "analysis",
        current_user["plan"],
        current_user.get("plan_expires_at"),
    )

    # 1. 验证项目存在且属于当前用户（含软删除过滤）
    project = await get_owned_project(db, project_id, current_user["id"])

    # 2. 验证项目状态（真实数据：inspected / analyzed；模拟数据：simulated）
    is_real = project.mode == "real"
    if is_real:
        if project.status not in ("inspected", "analyzed"):
            raise ValidationException("项目状态不正确，请先完成题目体检并导入真实数据")
    else:
        if project.status != "simulated":
            raise ValidationException("项目状态不正确，请先完成数据生成")

    # 3. 获取维度列表
    result = await db.execute(
        select(Question.dimension)
        .where(Question.project_id == project_id)
        .distinct()
    )
    dimensions = [row[0] for row in result.all() if row[0]]

    # 4. 获取题目-维度映射
    result = await db.execute(
        select(Question).where(Question.project_id == project_id)
    )
    questions = result.scalars().all()
    dimension_items = {}
    for q in questions:
        if q.dimension not in dimension_items:
            dimension_items[q.dimension] = []
        dimension_items[q.dimension].append(f"q{q.index}")

    # 5. 读取数据集并准备题目级 / 维度级 DataFrame
    from app.models.dataset import Dataset
    import pandas as pd
    import numpy as np

    sim_config = None
    if is_real:
        result = await db.execute(
            select(Dataset)
            .where(Dataset.project_id == project_id, Dataset.source == "real")
            .order_by(Dataset.created_at.desc())
            .limit(1)
        )
        dataset = result.scalar_one_or_none()
        if not dataset:
            raise NotFoundException("未找到真实数据集，请先导入数据")

        # 真实数据已是题目级（列名为 q{index}），导入时已完成反向计分
        df = pd.DataFrame(dataset.data, columns=dataset.columns)

        # 差异检验使用维度均值
        dim_data = {}
        for dim, items in dimension_items.items():
            valid_items = [item for item in items if item in df.columns]
            if valid_items:
                dim_data[dim] = df[valid_items].mean(axis=1)
        dim_df = pd.DataFrame(dim_data)

        sample_size = dataset.sample_size
        reverse_scored = True
    else:
        # 模拟数据：获取最新模拟配置
        result = await db.execute(
            select(SimulationConfig)
            .where(SimulationConfig.project_id == project_id)
            .order_by(SimulationConfig.created_at.desc())
            .limit(1)
        )
        sim_config = result.scalar_one_or_none()
        if not sim_config:
            raise NotFoundException("未找到模拟配置")

        result = await db.execute(
            select(Dataset)
            .where(Dataset.project_id == project_id)
            .order_by(Dataset.created_at.desc())
            .limit(1)
        )
        dataset = result.scalar_one_or_none()
        if not dataset:
            raise NotFoundException(ERR_DATASET_NOT_FOUND)

        dim_df = pd.DataFrame(dataset.data, columns=dataset.columns)

        # 展开维度级数据为题目级数据（同维度多题 = 维度值 + 小扰动）
        rng = np.random.default_rng(42)
        data = {}
        for dim, items in dimension_items.items():
            if dim in dim_df.columns:
                base = dim_df[dim].values
                for item in items:
                    noise = rng.normal(0, 0.5, size=len(base))
                    data[item] = np.clip(np.round(base + noise), 1, 5).astype(int)
            else:
                base = dim_df.iloc[:, 0].values if not dim_df.empty else np.ones(sim_config.sample_size) * 3
                for item in items:
                    data[item] = rng.integers(1, 6, size=len(base))
        df = pd.DataFrame(data)

        sample_size = sim_config.sample_size
        reverse_scored = False

    # 6. 调用统计分析服务
    from app.services.stats import analyze_reliability
    reliability_results = analyze_reliability(df, dimensions, dimension_items)

    # 7. 计算差异检验（不落库，按假设路径实时计算，对应架构文档 9.6）
    diff_tests = await _compute_diff_tests(db, project_id, dim_df)

    # 8. 调用诊断服务
    from app.services.diagnoser import diagnose
    project_meta = {
        "sample_size": sample_size,
        "dimension_count": len(dimensions),
        "has_reverse_items": any(getattr(q, "is_reverse", False) for q in questions),
        "reverse_scored": reverse_scored,
    }
    diagnosis_result = diagnose(
        reliability_results, project_meta, diff_tests=diff_tests
    )

    # 9. 保存报告
    overall_alpha = sum(r["alpha"] for r in reliability_results) / len(reliability_results) if reliability_results else 0
    passed_count = sum(1 for r in reliability_results if r["passed"])

    report = Report(
        project_id=project_id,
        dataset_id=dataset.id,
        overall_alpha=overall_alpha,
        passed_count=passed_count,
        total_count=len(reliability_results)
    )
    db.add(report)
    await db.flush()

    # 10. 保存信效度结果
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

    # 11. 保存诊断结果
    diagnosis = Diagnosis(
        report_id=report.id,
        passed=diagnosis_result["passed"]
    )
    db.add(diagnosis)
    await db.flush()

    for issue in diagnosis_result.get("issues", []):
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

    # 12. 更新项目状态
    update_project_status(project, "analyzed", reason="报告分析完成")

    # 13. 记录审计日志
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
            "mode": project.mode,
            "dataset_id": str(dataset.id),
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )

    await db.flush()

    # 14. 返回报告 + 差异检验
    report = await _load_report_with_relations(db, report.id)
    if report is None:
        raise NotFoundException(ERR_REPORT_NOT_FOUND)

    return ResponseModel(data=_build_report_response(report, diff_tests, sample_size))


@router.post(
    "/export/{report_id}",
    summary="导出报告",
    description="导出报告（word / excel / pdf），含 simulated 水印。"
)
async def export(
    report_id: UUID,
    request: ExportRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """导出报告（word / excel / pdf），含 simulated 水印。"""
    # 0. 校验并扣减免费额度
    await check_and_consume_quota(
        db,
        current_user["id"],
        "export",
        current_user["plan"],
        current_user.get("plan_expires_at"),
    )

    # 1. 加载报告及关联数据
    report = await _load_report_with_relations(db, report_id)
    if not report:
        raise NotFoundException(ERR_REPORT_NOT_FOUND)

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

    # 4. 转换为字典（导出场景数值字符串化）
    report_data = _build_report_data(report, diff_tests, as_str=True)

    # 5. 调用导出服务
    from app.services.reporter import export_word, export_excel, export_pdf

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
    elif request.format == "pdf":
        file_bytes = export_pdf(report_data)
        media_type = "application/pdf"
        filename = f"report_{report_id}_{suffix}.pdf"
    elif request.format == "ppt":
        from app.services.ppt_exporter import export_ppt
        file_bytes = export_ppt(report_data)
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        filename = f"report_{report_id}_{suffix}.pptx"
    else:
        raise ValidationException(ERR_UNSUPPORTED_FORMAT)

    # 6. 返回文件
    return StreamingResponse(
        iter([file_bytes]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post(
    "/polish/{report_id}",
    response_model=ResponseModel[PolishResponse],
    summary="报告文字润色",
    description="使用 LLM 将统计结果转化为论文段落。付费功能，免费用户 2 次/周。"
)
async def polish_report(
    report_id: UUID,
    request: PolishRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """报告文字润色：将统计结果转化为论文段落。"""
    # 0. 校验并扣减免费额度（report_polish: 免费 2 次/周，付费无限）
    await check_and_consume_quota(
        db,
        current_user["id"],
        "report_polish",
        current_user["plan"],
        current_user.get("plan_expires_at"),
    )

    # 1. 加载报告及关联数据
    report = await _load_report_with_relations(db, report_id)
    if not report:
        raise NotFoundException(ERR_REPORT_NOT_FOUND)

    # 2. 验证项目归属
    await get_owned_project(db, report.project_id, current_user["id"])

    # 3. 实时计算差异检验
    diff_tests: List[Dict[str, Any]] = []
    df = await _load_dataset_df(db, report.project_id)
    if df is not None:
        diff_tests = await _compute_diff_tests(db, report.project_id, df)

    # 4. 构建报告数据（LLM 读取需数值类型）
    report_data = _build_report_data(report, diff_tests, as_str=False)

    # 5. 调用润色服务
    from app.services.report_polisher import polish_section
    try:
        polish_result = polish_section(report_data, request.section)
    except ValueError as e:
        raise ValidationException(str(e))
    except Exception as e:
        raise ValidationException(f"润色失败：{str(e)}")

    # 6. 记录审计日志
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES.get("REPORT_POLISH", "REPORT_POLISH"),
        project_id=report.project_id,
        action_detail={
            "report_id": str(report_id),
            "section": request.section,
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )

    return ResponseModel(
        data=PolishResponse(
            section=polish_result["section"],
            text=polish_result["text"],
            disclaimer=polish_result["disclaimer"],
        )
    )


# ---------------------------------------------------------------------------
# 样本代表性诊断（F-RPT-007）
# ---------------------------------------------------------------------------

# 进程内缓存：LLM 说人话结论较贵，5 分钟内同一项目复用，避免页面刷新重复调用
_cache: Dict[str, dict] = {}
_CACHE_TTL_SECONDS = 300


@router.get(
    "/{project_id}/sample-representativeness",
    response_model=ResponseModel[SampleRepresentativenessResponse],
    summary="样本代表性诊断",
    description="基于真实数据集与人口学变量做样本结构体检（N/性别分布/结构集中度）。免费能力。"
)
async def get_sample_representativeness(
    project_id: UUID,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """样本代表性体检：规则诊断（必出）+ LLM 说人话补充（失败降级）。

    差异化边界：只做诊断与改进建议，不提供样本购买/投放/收集服务。
    """
    # 1. 验证项目归属
    project = await get_owned_project(db, project_id, current_user["id"])
    if not project:
        raise NotFoundException("项目不存在或无访问权限")

    # 2. 仅真实数据项目支持（模拟数据由用户自定参数，无代表性概念）
    if project.mode != "real":
        return ResponseModel(
            data=SampleRepresentativenessResponse(
                supported=False,
                message="样本代表性诊断仅适用于真实数据项目。模拟预演数据为按假设参数生成，不涉及样本代表性。",
            )
        )

    # 3. 加载题目与真实数据集
    from app.models.dataset import Dataset
    from app.services.sample_representativeness import (
        SampleRepresentativenessEngine,
        llm_enrich,
    )

    result = await db.execute(
        select(Question)
        .where(Question.project_id == project_id)
        .order_by(Question.index)
    )
    questions = result.scalars().all()

    result = await db.execute(
        select(Dataset)
        .where(Dataset.project_id == project_id, Dataset.source == "real")
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()

    # 4. 规则诊断（确定性）
    df = pd.DataFrame(dataset.data, columns=dataset.columns) if dataset else None
    engine_report = SampleRepresentativenessEngine(
        questions, df, dataset.sample_size if dataset else 0
    ).run()

    # 5. LLM 说人话补充（缓存 5 分钟；失败返回空串，前端降级）
    cache_key = f"{project_id}:{dataset.id if dataset else 'none'}"
    ai_conclusion = ""
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached["ts"] < _CACHE_TTL_SECONDS:
        ai_conclusion = cached["text"]
    else:
        ai_conclusion = llm_enrich(engine_report)
        if ai_conclusion:
            _cache[cache_key] = {"ts": now, "text": ai_conclusion}

    response = SampleRepresentativenessResponse(**engine_report.to_dict())
    response.ai_conclusion = ai_conclusion

    # 6. 记录审计日志
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["SAMPLE_REP_CHECK"],
        project_id=project_id,
        action_detail={
            "sample_size": response.sample_size,
            "has_demographic": response.has_demographic,
            "grade": response.grade,
            "score": response.overall_score,
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )
    await db.flush()

    return ResponseModel(data=response)


# ---------------------------------------------------------------------------
# 样本量规划器（F-RPT-008）
# ---------------------------------------------------------------------------


async def _resolve_effect_size(
    db: AsyncSession,
    project: Any,
    user_effect_size: Optional[float],
    default: float,
) -> tuple[float, str]:
    """解析效应量来源：user（手填）> simulation（预演矩阵）> default（默认中等效应）。

    Returns:
        (效应量, 来源标识)
    """
    if user_effect_size is not None:
        return user_effect_size, "user"

    # 模拟项目：从最新相关矩阵取非对角线最大相关作为效应量
    if project.mode == "simulation":
        from app.models.correlation_matrix import CorrelationMatrix
        result = await db.execute(
            select(CorrelationMatrix)
            .where(CorrelationMatrix.project_id == project.id)
            .order_by(CorrelationMatrix.created_at.desc())
            .limit(1)
        )
        matrix = result.scalar_one_or_none()
        cells = (matrix.cells if matrix else None) or []
        values = [
            float(cell.get("value", 0.0))
            for row in cells
            if isinstance(row, list)
            for cell in row
        ]
        max_abs = max((abs(v) for v in values if v != 0), default=0.0)
        if max_abs > 0 and max_abs < 1:
            return round(max_abs, 3), "simulation"

    return default, "default"


@router.post(
    "/{project_id}/sample-size-planner",
    response_model=ResponseModel[SampleSizePlannerResponse],
    summary="样本量规划",
    description="按分析类型与效应量计算所需样本量并给出回收目标（功效分析闭式解，确定性规则）。免费能力。"
)
async def plan_sample_size(
    project_id: UUID,
    request: SampleSizePlannerRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """样本量规划：公式计算（必出）+ 规则建议（说人话），无 LLM。

    差异化边界：只做规划与建议，不提供样本购买/投放/收集服务。
    与 F-RPT-007 样本代表性诊断互文：回收前定目标，回收后验结构。
    """
    # 1. 验证项目归属（含软删除过滤）
    project = await get_owned_project(db, project_id, current_user["id"])

    # 2. 解析效应量来源
    from app.core.statistics_constants import (
        PLANNER_ALPHA_DEFAULT,
        PLANNER_POWER_DEFAULT,
        STRENGTH_NOMINAL,
        T_TEST_DEFAULT_D,
    )
    default_effect = T_TEST_DEFAULT_D if request.analysis_type == "t_test" else STRENGTH_NOMINAL["medium"]
    effect_size, effect_source = await _resolve_effect_size(
        db, project, request.effect_size, default_effect
    )

    # 3. 回归分析需从预演矩阵取自变量个数（无矩阵时按维度数兜底）
    predictors: Optional[int] = None
    if request.analysis_type == "regression":
        from app.models.correlation_matrix import CorrelationMatrix
        result = await db.execute(
            select(CorrelationMatrix)
            .where(CorrelationMatrix.project_id == project_id)
            .order_by(CorrelationMatrix.created_at.desc())
            .limit(1)
        )
        matrix = result.scalar_one_or_none()
        dims = (matrix.dimensions if matrix else None) or []
        dim_names = dims if isinstance(dims, list) else []
        predictors = max(len(dim_names) - 1, 1)

    # 4. 公式计算 + 规则建议
    from app.services.sample_size_planner import build_plan
    try:
        plan = build_plan(
            request.analysis_type,
            effect_size,
            request.alpha,
            request.power,
            effect_source=effect_source,
            predictors=predictors,
            planned_n=request.planned_n,
        )
    except ValueError as e:
        raise ValidationException(str(e))

    # 5. 记录审计日志
    await AuditService.log_action(
        db=db,
        user_id=current_user["id"],
        action_type=ACTION_TYPES["SAMPLE_PLANNER"],
        project_id=project_id,
        action_detail={
            "analysis_type": plan["analysis_type"],
            "effect_source": effect_source,
            "effect_size": plan["effect_size"],
            "required_n": plan["required_n"],
            "recommended_n": plan["recommended_n"],
            "verdict": plan["verdict"],
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent"),
    )
    await db.flush()

    return ResponseModel(data=SampleSizePlannerResponse(**plan))
