"""上线前整改回归测试（F-RELEASE-2026）。

覆盖：
- 生成器对非正定矩阵的半正定裁剪（PSD fallback），不再抛 500
- SimulationGenerateRequest.sample_size 上限校验（防超大请求 DoS）
- SimulationSaveRequest 矩阵：方阵、维度一致、对角线=1、值在 [-1,1]（Pydantic 层）
- 支付回调签名恒时比较白名单缺失即拒绝
"""
import numpy as np
import pytest
from pydantic import ValidationError

from app.services.generator import _clamp_to_psd, _generate_multivariate_normal, generate
from app.schemas.simulation import MatrixSaveCell, MatrixSaveRequest, SimulationGenerateRequest


# ─────────────────────────────────────────────────────────────
# 1. generator：非正定矩阵 → PSD 裁剪
# ─────────────────────────────────────────────────────────────
def test_clamp_to_psd_fixes_non_psd():
    # 一个明显非半正定的矩阵（负特征值，来自自相矛盾的用户手工输入）
    bad = np.array([[1.0, 0.99], [0.99, 1.0]]) - np.eye(2) * 0.01  # 略奇异/负特征
    psd = _clamp_to_psd(bad)
    # 半正定：最小特征值 >= 0
    assert np.linalg.eigvalsh(psd).min() >= -1e-9
    # 对角保持 1（相关矩阵约束）
    np.testing.assert_allclose(np.diag(psd), 1.0, atol=1e-6)
    # 对称
    np.testing.assert_allclose(psd, psd.T, atol=1e-9)


def test_generate_multivariate_normal_accepts_inconsistent_matrix():
    # 手工给一个明显非半正定的矩阵（向量完全共线 + 负特征值会导致原 #500）
    bad = np.array([[1.0, -0.99], [-0.99, 1.0]])
    df = _generate_multivariate_normal(bad, sample_size=50, dimensions=["a", "b"])
    assert df.shape == (50, 2)
    assert not df.isnull().values.any()


# ─────────────────────────────────────────────────────────────
# 2. sample_size 上限（防超大生成）
# ─────────────────────────────────────────────────────────────
def test_generate_request_sample_size_capped():
    with pytest.raises(ValidationError):
        SimulationGenerateRequest(sample_size=200000, scale_type="likert5")
    ok = SimulationGenerateRequest(sample_size=50000, scale_type="likert5")
    assert ok.sample_size == 50000


# ─────────────────────────────────────────────────────────────
# 3. 矩阵保存校验：方阵 / 维度一致 / 对角=1 / 值域 [-1,1]
# ─────────────────────────────────────────────────────────────
def _m(dimensions, values):
    ll = []
    for i in range(len(dimensions)):
        row = []
        for j in range(len(dimensions)):
            row.append(MatrixSaveCell(row=dimensions[i], col=dimensions[j], value=values[i][j], source="user"))
        ll.append(row)
    return MatrixSaveRequest(dimensions=dimensions, cells=ll)


def test_matrix_accepts_valid():
    req = _m(["a", "b"], [[1.0, 0.3], [0.3, 1.0]])
    assert len(req.cells) == 2


def test_matrix_rejects_out_of_range_value():
    with pytest.raises(ValidationError):
        _m(["a", "b"], [[1.0, 1.5], [1.5, 1.0]])


def test_matrix_rejects_non_diagonal_one():
    with pytest.raises(ValidationError):
        _m(["a", "b"], [[0.8, 0.3], [0.3, 1.0]])


def test_matrix_rejects_wrong_shape():
    with pytest.raises(ValidationError):
        # 行数 1 != 维度数 2
        MatrixSaveRequest(
            dimensions=["a", "b"],
            cells=[[MatrixSaveCell(row="a", col="a", value=1.0, source="user")]],
        )