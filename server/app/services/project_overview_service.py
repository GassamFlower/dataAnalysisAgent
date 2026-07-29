"""项目概览聚合服务。

为项目详情页与项目列表提供一次查询即可渲染的聚合数据：
- 题目统计（总数 / 维度数 / 反向题数）
- 最新数据集摘要（来源 / 样本量 / 导入时间）
- 最新报告摘要（是否已生成 / α / 达标维度数 / 生成时间）
"""
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.question import Question


def _filter_not_deleted(items):
    """过滤软删除记录。"""
    return [item for item in items if getattr(item, "deleted_at", None) is None]


def _latest_by_created(items):
    """取按 created_at 降序排列后的第一条记录。"""
    valid = _filter_not_deleted(items)
    if not valid:
        return None
    return max(valid, key=lambda x: x.created_at)


def _build_question_stats(questions: List[Question]) -> Dict:
    """统计题目数量、维度数量、反向题数量。"""
    valid_questions = _filter_not_deleted(questions)
    dimensions = {q.dimension for q in valid_questions if q.dimension}
    reverse_count = sum(1 for q in valid_questions if q.is_reverse)

    return {
        "question_count": len(valid_questions),
        "dimension_count": len(dimensions),
        "reverse_count": reverse_count,
    }


def _build_dataset_overview(project: Project) -> Dict:
    """构建最新数据集概览。"""
    dataset = _latest_by_created(project.datasets or [])
    if not dataset:
        return {
            "source": None,
            "sample_size": None,
            "imported_at": None,
        }

    return {
        "source": dataset.source,
        "sample_size": dataset.sample_size,
        "imported_at": dataset.created_at,
    }


def _build_report_overview(project: Project) -> Dict:
    """构建最新报告概览。"""
    report = _latest_by_created(project.reports or [])
    if not report:
        return {
            "has_report": False,
            "overall_alpha": None,
            "passed_count": None,
            "total_count": None,
            "generated_at": None,
        }

    return {
        "has_report": True,
        "overall_alpha": float(report.overall_alpha) if report.overall_alpha is not None else None,
        "passed_count": report.passed_count,
        "total_count": report.total_count,
        "generated_at": report.created_at,
    }


async def get_project_overview(project: Project) -> Dict:
    """聚合项目概览数据。

    Args:
        project: Project ORM 对象，需已加载 questions / datasets / reports 关联。

    Returns:
        可直接交给 ProjectOverview Pydantic 模型校验的 dict。
    """
    stats = _build_question_stats(project.questions or [])
    dataset_overview = _build_dataset_overview(project)
    report_overview = _build_report_overview(project)

    return {
        "question_count": stats["question_count"],
        "dimension_count": stats["dimension_count"],
        "reverse_count": stats["reverse_count"],
        "dataset": dataset_overview,
        "report": report_overview,
    }


async def get_project_list_stats(project: Project) -> Dict:
    """项目列表所需的轻量统计（题目数 / 维度数）。

    Args:
        project: Project ORM 对象，需已加载 questions 关联。

    Returns:
        dict with question_count, dimension_count.
    """
    stats = _build_question_stats(project.questions or [])
    return {
        "question_count": stats["question_count"],
        "dimension_count": stats["dimension_count"],
    }
