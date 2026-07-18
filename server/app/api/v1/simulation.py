"""数据生成路由（A 体验 + C 底层）。"""
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_paid_plan
from app.core.responses import ResponseModel
from app.core.exceptions import NotFoundException, ValidationException
from app.models.project import Project
from app.models.hypothesis import Hypothesis
from app.models.hypothesis_path import HypothesisPath
from app.models.question import Question
from app.models.correlation_matrix import CorrelationMatrix
from app.models.dataset import Dataset
from app.schemas.simulation import (
    HypothesisCreateRequest,
    HypothesisResponse,
    SimulationGenerateRequest,
    SimulationConfigResponse,
    MatrixCellResponse,
    SimulationMatrixResponse,
    HypothesisPathItem,
    MatrixSaveRequest,
    MatrixSaveResponse,
)
from app.services.hypothesis_parser import parse_hypothesis
from app.services.project_service import update_project_status

router = APIRouter(prefix="/simulation", tags=["simulation"])


# 强度档位 → 目标相关系数（与 generator.STRENGTH_TO_R 一致）
_STRENGTH_TO_R = {"weak": 0.2, "medium": 0.4, "strong": 0.6}


@router.get(
    "/{project_id}",
    response_model=ResponseModel[SimulationMatrixResponse],
    summary="获取模拟矩阵",
    description="从已保存的假设路径重建相关矩阵（透明展示：用户假设 vs 系统补全）"
)
async def get_simulation_matrix(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """从假设路径重建相关矩阵。"""
    # 1. 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 2. 获取维度列表
    result = await db.execute(
        select(Question.dimension)
        .where(Question.project_id == project_id)
        .distinct()
    )
    dimensions = [row[0] for row in result.all() if row[0]]

    # 3. 获取最新假设 + 路径
    result = await db.execute(
        select(Hypothesis)
        .where(Hypothesis.project_id == project_id)
        .order_by(Hypothesis.created_at.desc())
        .limit(1)
    )
    hypothesis = result.scalar_one_or_none()

    paths: list = []
    if hypothesis:
        result = await db.execute(
            select(HypothesisPath).where(HypothesisPath.hypothesis_id == hypothesis.id)
        )
        paths = result.scalars().all()

    # 4. 查询已保存的矩阵（用户编辑持久化）
    result = await db.execute(
        select(CorrelationMatrix)
        .where(CorrelationMatrix.project_id == project_id)
        .order_by(CorrelationMatrix.updated_at.desc())
        .limit(1)
    )
    saved_matrix = result.scalar_one_or_none()

    if saved_matrix:
        # 用已保存的矩阵（用户编辑后的权威版本）
        cells = [
            [
                MatrixCellResponse(
                    row=c.get("row", ""),
                    col=c.get("col", ""),
                    value=float(c.get("value", 0.0)),
                    source=c.get("source", "system"),
                )
                for c in row
            ]
            for row in saved_matrix.cells
        ]
    else:
        # 从 paths 重建矩阵（用户假设 source="user"，其余 source="system"）
        n = len(dimensions)
        dim_index = {d: i for i, d in enumerate(dimensions)}
        # 先标记用户假设的 (i, j) 对
        user_pairs: set = set()
        for p in paths:
            if p.predictor in dim_index and p.outcome in dim_index:
                i, j = dim_index[p.predictor], dim_index[p.outcome]
                user_pairs.add((i, j))
                user_pairs.add((j, i))  # 对称

        cells: list = []
        for i, row_dim in enumerate(dimensions):
            row_cells: list = []
            for j, col_dim in enumerate(dimensions):
                if i == j:
                    row_cells.append(MatrixCellResponse(
                        row=row_dim, col=col_dim, value=1.0, source="system"
                    ))
                elif (i, j) in user_pairs:
                    # 找到对应的路径
                    p = next(
                        (pp for pp in paths
                         if dim_index.get(pp.predictor) in (i, j)
                         and dim_index.get(pp.outcome) in (i, j)),
                        None
                    )
                    if p:
                        r = _STRENGTH_TO_R.get(p.strength, 0.3)
                        if p.direction == "negative":
                            r = -r
                        row_cells.append(MatrixCellResponse(
                            row=row_dim, col=col_dim, value=round(r, 2), source="user"
                        ))
                    else:
                        row_cells.append(MatrixCellResponse(
                            row=row_dim, col=col_dim, value=0.0, source="system"
                        ))
                else:
                    row_cells.append(MatrixCellResponse(
                        row=row_dim, col=col_dim, value=0.0, source="system"
                    ))
            cells.append(row_cells)

    # 5. 构建路径响应（回传已保存路径供前端展示）
    path_items = [
        HypothesisPathItem(
            predictor=p.predictor,
            outcome=p.outcome,
            direction=p.direction,
            strength=p.strength,
        )
        for p in paths
    ]

    return ResponseModel(data=SimulationMatrixResponse(
        dimensions=dimensions,
        cells=cells,
        hypothesis_text=hypothesis.raw_text if hypothesis else None,
        paths=path_items,
    ))


@router.put(
    "/{project_id}/matrix",
    response_model=ResponseModel[MatrixSaveResponse],
    summary="保存相关矩阵",
    description="保存用户编辑的相关矩阵到数据库（持久化）"
)
async def save_matrix(
    project_id: UUID,
    request: MatrixSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """保存用户编辑的相关矩阵（upsert，每项目一条记录）。"""
    # 1. 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 2. 查询是否已有矩阵记录
    result = await db.execute(
        select(CorrelationMatrix)
        .where(CorrelationMatrix.project_id == project_id)
        .order_by(CorrelationMatrix.updated_at.desc())
        .limit(1)
    )
    existing = result.scalar_one_or_none()

    # 3. 序列化 cells 为可存储的 JSON 格式
    cells_data = [
        [
            {"row": c.row, "col": c.col, "value": c.value, "source": c.source}
            for c in row
        ]
        for row in request.cells
    ]

    if existing:
        # 更新现有记录
        existing.dimensions = request.dimensions
        existing.cells = cells_data
        await db.flush()
        await db.refresh(existing)
        matrix_id = existing.id
    else:
        # 创建新记录
        matrix = CorrelationMatrix(
            project_id=project_id,
            dimensions=request.dimensions,
            cells=cells_data,
        )
        db.add(matrix)
        await db.flush()
        await db.refresh(matrix)
        matrix_id = matrix.id

    return ResponseModel(data=MatrixSaveResponse(
        matrix_id=matrix_id,
        project_id=project_id,
    ))


@router.post(
    "/hypothesis/{project_id}",
    response_model=ResponseModel[HypothesisResponse],
    summary="创建假设",
    description="用户写一句话假设，LLM 解析为主效应路径 + 强度档位"
)
async def create_hypothesis(
    project_id: UUID,
    request: HypothesisCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_paid_plan)
):
    """创建假设：解析用户假设为主效应路径。"""
    # 1. 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 2. 获取项目维度（来自题目体检）
    result = await db.execute(
        select(Question.dimension)
        .where(Question.project_id == project_id)
        .distinct()
    )
    dimensions = [row[0] for row in result.all() if row[0]]

    # 3. 调用假设解析服务（LLM）
    try:
        paths = parse_hypothesis(request.raw_text, dimensions)
    except Exception as e:
        raise ValidationException(f"假设解析失败: {str(e)}")

    # 3.5 删除旧的矩阵记录（新假设 → 矩阵需要重建）
    result = await db.execute(
        select(CorrelationMatrix).where(CorrelationMatrix.project_id == project_id)
    )
    old_matrices = result.scalars().all()
    for m in old_matrices:
        await db.delete(m)

    # 4. 保存假设到数据库
    hypothesis = Hypothesis(
        project_id=project_id,
        raw_text=request.raw_text
    )
    db.add(hypothesis)
    await db.flush()

    # 5. 保存路径
    for p in paths:
        path = HypothesisPath(
            hypothesis_id=hypothesis.id,
            predictor=p.predictor,
            outcome=p.outcome,
            direction=p.direction,
            strength=p.strength
        )
        db.add(path)

    # 6. 更新项目状态
    update_project_status(project, "hypothesized", reason="假设输入完成")
    await db.flush()

    # 7. 返回结果（显式加载 paths 关系）
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Hypothesis)
        .options(selectinload(Hypothesis.paths))
        .where(Hypothesis.id == hypothesis.id)
    )
    hypothesis = result.scalar_one()

    return ResponseModel(data=hypothesis)


@router.post(
    "/generate",
    response_model=ResponseModel[SimulationConfigResponse],
    summary="数据生成",
    description="按份数 + 期望趋势生成模拟数据。付费能力。约束反向生成，α 达标率目标 ≥70%。"
)
async def generate(
    request: SimulationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_paid_plan)
):
    """按份数 + 期望趋势生成模拟数据。"""
    # 1. 验证假设存在
    result = await db.execute(
        select(Hypothesis).where(Hypothesis.id == request.hypothesis_id)
    )
    hypothesis = result.scalar_one_or_none()
    if not hypothesis:
        raise NotFoundException("假设不存在")

    # 2. 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == hypothesis.project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 3. 获取维度列表
    result = await db.execute(
        select(Question.dimension)
        .where(Question.project_id == hypothesis.project_id)
        .distinct()
    )
    dimensions = [row[0] for row in result.all() if row[0]]

    # 4. 获取路径列表
    result = await db.execute(
        select(HypothesisPath).where(HypothesisPath.hypothesis_id == hypothesis.id)
    )
    paths = result.scalars().all()

    # 5. 获取相关矩阵（如果有）
    custom_cells = None
    if request.matrix_id:
        result = await db.execute(
            select(CorrelationMatrix).where(CorrelationMatrix.id == request.matrix_id)
        )
        matrix = result.scalar_one_or_none()
        if matrix:
            custom_cells = matrix.cells

    # 6. 调用数据生成服务
    from app.services.generator import generate as generate_data
    from app.schemas.simulation import HypothesisPath as SchemaPath

    schema_paths = [
        SchemaPath(
            predictor=p.predictor,
            outcome=p.outcome,
            direction=p.direction,
            strength=p.strength
        )
        for p in paths
    ]

    try:
        df = generate_data(
            dimensions=dimensions,
            paths=schema_paths,
            sample_size=request.sample_size,
            custom_cells=custom_cells
        )
    except Exception as e:
        raise ValidationException(f"数据生成失败: {str(e)}")

    # 7. 保存模拟配置
    from app.models.simulation_config import SimulationConfig
    config = SimulationConfig(
        project_id=hypothesis.project_id,
        sample_size=request.sample_size,
        hypothesis_id=hypothesis.id,
        matrix_id=request.matrix_id
    )
    db.add(config)
    await db.flush()

    # 8. 保存数据集（JSON records 格式，转为原生 Python 类型避免序列化问题）
    import json
    dataset = Dataset(
        simulation_config_id=config.id,
        project_id=hypothesis.project_id,
        sample_size=request.sample_size,
        columns=df.columns.tolist(),
        data=json.loads(df.to_json(orient="records")),
    )
    db.add(dataset)

    # 9. 更新项目状态
    update_project_status(project, "simulated", reason="数据预演完成")
    await db.flush()

    return ResponseModel(data=config)


@router.post(
    "/export-data/{project_id}",
    summary="导出模拟数据",
    description="导出模拟数据集（Excel），含 simulated 水印。付费能力。"
)
async def export_data(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_paid_plan)
):
    """导出模拟数据集（Excel），含 simulated 水印。"""
    # 1. 验证项目存在且属于当前用户
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user["id"]
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("项目不存在")

    # 2. 验证项目状态（至少已生成数据）
    if project.status not in ("simulated", "analyzed"):
        raise ValidationException("项目状态不正确，请先生成数据")

    # 3. 获取最新数据集
    result = await db.execute(
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise NotFoundException("未找到模拟数据集，请先生成数据")

    # 4. 调用导出服务
    from app.services.reporter import export_dataset_excel

    meta = {
        "project_id": str(project_id),
        "sample_size": dataset.sample_size,
    }
    file_bytes = export_dataset_excel(
        columns=dataset.columns,
        data=dataset.data,
        meta=meta,
    )

    # 5. 返回 Excel 文件
    filename = f"dataset_{project_id}.xlsx"
    return StreamingResponse(
        iter([file_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
