"""SPSS .sav 导入解析服务单元测试。

覆盖（testing-strategy 第二步：三类用例）：
- 正常：标准 .sav 文件解析、变量标签/值标签提取、内部格式转换
- 边界：空文件、无标签文件、纯数值文件、NaN 值
- 异常：损坏文件、非 .sav 内容、缺少依赖（mock）

设计依据：docs/x-功能-SPSS导入.md
"""
import os
import tempfile

import pytest

from app.services.spss_parser import parse_spss_sav, convert_to_internal_format


def _write_sav_to_bytes(df, variable_labels=None, value_labels=None) -> bytes:
    """将 DataFrame 写入 .sav 文件并返回二进制内容。

    pyreadstat.write_sav 仅接受文件路径（不支持 BytesIO），
    故使用临时文件中转。
    """
    pyreadstat = pytest.importorskip("pyreadstat")

    column_labels = None
    if variable_labels:
        column_labels = [variable_labels[c] for c in df.columns]

    # 用 NamedTemporaryFile 避免 Windows 文件占用问题
    fd, path = tempfile.mkstemp(suffix=".sav")
    try:
        os.close(fd)
        pyreadstat.write_sav(
            df,
            path,
            column_labels=column_labels,
            variable_value_labels=value_labels or {},
        )
        with open(path, "rb") as f:
            return f.read()
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _build_minimal_sav() -> bytes:
    """构造一个最小的合法 .sav 文件内容。

    包含变量标签和值标签，供解析测试使用。
    """
    import pandas as pd

    df = pd.DataFrame({
        "Q1": [1, 2, 3, 4, 5],
        "Q2": [5, 4, 3, 2, 1],
        "gender": [1, 2, 1, 2, 1],
    })

    variable_labels = {
        "Q1": "学习动机题1",
        "Q2": "学习动机题2",
        "gender": "性别",
    }
    value_labels = {
        "gender": {1: "男", 2: "女"},
    }

    return _write_sav_to_bytes(df, variable_labels, value_labels)


# ============================
# 正常用例
# ============================

def test_parse_spss_sav_standard_file():
    """正常：标准 .sav 文件解析成功，提取变量标签和值标签。"""
    sav_content = _build_minimal_sav()
    result = parse_spss_sav(sav_content)

    # 验证 DataFrame
    assert result["dataframe"].shape == (5, 3)
    assert list(result["dataframe"].columns) == ["Q1", "Q2", "gender"]

    # 验证变量标签
    assert result["variable_labels"]["Q1"] == "学习动机题1"
    assert result["variable_labels"]["gender"] == "性别"

    # 验证值标签
    gender_labels = result["value_labels"].get("gender", {})
    assert gender_labels.get(1.0) == "男" or gender_labels.get(1) == "男"

    # 验证元数据
    assert result["metadata"]["variable_count"] == 3
    assert result["metadata"]["sample_size"] == 5


def test_convert_to_internal_format_standard():
    """正常：解析结果转换为内部格式正确。"""
    sav_content = _build_minimal_sav()
    parse_result = parse_spss_sav(sav_content)
    internal = convert_to_internal_format(parse_result)

    # 验证列信息
    assert internal["columns"] == ["Q1", "Q2", "gender"]
    assert len(internal["column_info"]) == 3

    q1_info = next(c for c in internal["column_info"] if c["name"] == "Q1")
    assert q1_info["label"] == "学习动机题1"
    assert q1_info["type"] == "numeric"

    gender_info = next(c for c in internal["column_info"] if c["name"] == "gender")
    assert gender_info["label"] == "性别"

    # 验证数据
    assert len(internal["data"]) == 5
    assert internal["data"][0]["Q1"] == 1

    # 验证元数据
    assert internal["meta"]["source_format"] == "spss"
    assert internal["meta"]["sample_size"] == 5
    assert internal["meta"]["variable_count"] == 3


# ============================
# 边界用例
# ============================

def test_parse_spss_sav_no_labels():
    """边界：无变量标签的 .sav 文件，label 回退为列名。"""
    import pandas as pd

    df = pd.DataFrame({"var1": [1, 2, 3], "var2": [4, 5, 6]})
    sav_content = _write_sav_to_bytes(df)

    result = parse_spss_sav(sav_content)
    internal = convert_to_internal_format(result)

    # 无标签时，label 应回退为列名
    var1_info = next(c for c in internal["column_info"] if c["name"] == "var1")
    assert var1_info["label"] == "var1"


def test_convert_to_internal_format_nan_to_none():
    """边界：数据中的 NaN 应转换为 None。"""
    import pandas as pd
    import numpy as np

    df = pd.DataFrame({"Q1": [1, 2, np.nan, 4]})
    sav_content = _write_sav_to_bytes(df)

    result = parse_spss_sav(sav_content)
    internal = convert_to_internal_format(result)

    # 第 3 行 Q1 应为 None（NaN 转换）
    assert internal["data"][2]["Q1"] is None
    assert internal["data"][0]["Q1"] == 1


def test_convert_to_internal_format_empty_value_labels():
    """边界：无值标签时，column_info 中 value_labels 为空字典。"""
    import pandas as pd

    df = pd.DataFrame({"Q1": [1, 2, 3]})
    sav_content = _write_sav_to_bytes(df)

    result = parse_spss_sav(sav_content)
    internal = convert_to_internal_format(result)

    q1_info = internal["column_info"][0]
    assert q1_info["value_labels"] == {}


# ============================
# 异常用例
# ============================

def test_parse_spss_sav_corrupted_file():
    """异常：损坏的文件内容应抛出 ValueError。"""
    garbage = b"\x00\x01\x02not a sav file\xFF\xFE"
    with pytest.raises(ValueError, match="SPSS 文件解析失败"):
        parse_spss_sav(garbage)


def test_parse_spss_sav_empty_content():
    """异常：空内容应抛出 ValueError。"""
    with pytest.raises(ValueError):
        parse_spss_sav(b"")


def test_parse_spss_sav_missing_dependency(monkeypatch):
    """异常：缺少 pyreadstat 依赖时抛出 ValueError 并提示安装。"""
    import sys
    original_module = sys.modules.get("pyreadstat")
    monkeypatch.setitem(sys.modules, "pyreadstat", None)

    try:
        with pytest.raises(ValueError, match="缺少 SPSS 解析依赖"):
            parse_spss_sav(b"fake content")
    finally:
        if original_module is not None:
            monkeypatch.setitem(sys.modules, "pyreadstat", original_module)
