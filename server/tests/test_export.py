"""导出模块测试（Round 3.3 验收）。

覆盖：
- 模拟数据集 CSV / Excel 导出成功
- 模拟数据集导出状态守卫（非 simulated/analyzed 返回 400）
- 模拟数据集导出免费 403
- 报告 Word / Excel 导出成功
- 报告导出免费 403
"""

import io

import pytest
from httpx import AsyncClient
from openpyxl import load_workbook


@pytest.mark.anyio
async def test_export_dataset_excel_success(
    client: AsyncClient,
    paid_auth_headers: dict,
    simulated_project: dict,
):
    """付费用户导出模拟数据集 Excel 成功，含水印元数据。"""
    project_id = simulated_project["id"]

    resp = await client.post(
        f"/api/v1/simulation/{project_id}/export-data",
        headers=paid_auth_headers,
        json={"format": "excel"},
    )
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in resp.headers.get("content-type", "")
    assert "simulated" in resp.headers.get("content-disposition", "")

    wb = load_workbook(io.BytesIO(resp.content))
    assert "模拟数据" in wb.sheetnames
    assert "元数据" in wb.sheetnames

    ws_meta = wb["元数据"]
    meta_text = " ".join(str(ws_meta.cell(row=i, column=1).value) for i in range(1, 6))
    assert "SIMULATED" in meta_text


@pytest.mark.anyio
async def test_export_dataset_csv_success(
    client: AsyncClient,
    paid_auth_headers: dict,
    simulated_project: dict,
):
    """付费用户导出模拟数据集 CSV 成功，含 BOM 与水印注释。"""
    project_id = simulated_project["id"]

    resp = await client.post(
        f"/api/v1/simulation/{project_id}/export-data",
        headers=paid_auth_headers,
        json={"format": "csv"},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    disposition = resp.headers.get("content-disposition", "")
    assert "dataset_" in disposition and disposition.endswith(".csv")

    content = resp.content.decode("utf-8-sig")
    lines = content.splitlines()
    assert any("SIMULATED" in line for line in lines[:6])
    assert lines[6] == "学习动机"  # 表头
    assert len(lines) == 107  # 6 行注释 + 表头 + 100 行数据


@pytest.mark.anyio
async def test_export_dataset_status_guard(
    client: AsyncClient,
    paid_auth_headers: dict,
    created_project: dict,
):
    """draft 项目导出数据集返回 400。"""
    resp = await client.post(
        f"/api/v1/simulation/{created_project['id']}/export-data",
        headers=paid_auth_headers,
        json={"format": "excel"},
    )
    assert resp.status_code == 400
    assert "状态" in resp.json().get("message", "")


@pytest.mark.anyio
async def test_export_dataset_requires_paid_plan(
    client: AsyncClient,
    free_auth_headers: dict,
    simulated_project: dict,
):
    """free 用户导出数据集返回 403。"""
    resp = await client.post(
        f"/api/v1/simulation/{simulated_project['id']}/export-data",
        headers=free_auth_headers,
        json={"format": "excel"},
    )
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_export_report_word_success(
    client: AsyncClient,
    paid_auth_headers: dict,
    simulated_project: dict,
    mock_diagnoser,
):
    """付费用户导出 Word 报告成功，文件可解析且含水印。"""
    project_id = simulated_project["id"]

    # 先生成报告
    analyze_resp = await client.post(
        f"/api/v1/report/analyze/{project_id}",
        headers=paid_auth_headers,
    )
    assert analyze_resp.status_code == 200
    report_id = analyze_resp.json()["data"]["id"]

    resp = await client.post(
        f"/api/v1/report/export/{report_id}",
        headers=paid_auth_headers,
        json={"format": "word"},
    )
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in resp.headers.get("content-type", "")

    from docx import Document
    doc = Document(io.BytesIO(resp.content))
    full_text = "\n".join(p.text for p in doc.paragraphs)
    assert "SIMULATED" in full_text or any("SIMULATED" in section.header.paragraphs[0].text for section in doc.sections)
    assert "Cronbach's α" in full_text


@pytest.mark.anyio
async def test_export_report_excel_success(
    client: AsyncClient,
    paid_auth_headers: dict,
    simulated_project: dict,
    mock_diagnoser,
):
    """付费用户导出 Excel 报告成功，含水印与统计 sheet。"""
    project_id = simulated_project["id"]

    analyze_resp = await client.post(
        f"/api/v1/report/analyze/{project_id}",
        headers=paid_auth_headers,
    )
    assert analyze_resp.status_code == 200
    report_id = analyze_resp.json()["data"]["id"]

    resp = await client.post(
        f"/api/v1/report/export/{report_id}",
        headers=paid_auth_headers,
        json={"format": "excel"},
    )
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in resp.headers.get("content-type", "")

    wb = load_workbook(io.BytesIO(resp.content))
    assert "元数据" in wb.sheetnames
    assert "信效度结果" in wb.sheetnames
    assert "诊断问题" in wb.sheetnames


@pytest.mark.anyio
async def test_export_report_requires_paid_plan(
    client: AsyncClient,
    paid_auth_headers: dict,
    simulated_project: dict,
    mock_diagnoser,
):
    """free 用户导出报告返回 403。"""
    import uuid

    from app.core.database import get_db
    from app.models.user import User

    project_id = simulated_project["id"]
    dev_user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

    # 先生成报告（付费）
    analyze_resp = await client.post(
        f"/api/v1/report/analyze/{project_id}",
        headers=paid_auth_headers,
    )
    assert analyze_resp.status_code == 200
    report_id = analyze_resp.json()["data"]["id"]

    # 再将用户降级为 free，使用同一 token 请求导出
    async for db in get_db():
        user = await db.get(User, dev_user_id)
        user.plan = "free"
        user.plan_expires_at = None
        await db.commit()
        break

    resp = await client.post(
        f"/api/v1/report/export/{report_id}",
        headers=paid_auth_headers,
        json={"format": "word"},
    )
    assert resp.status_code == 403
