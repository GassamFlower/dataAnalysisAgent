"""
数据迁移脚本：从开发环境 SQLite 导出数据，生成 PostgreSQL INSERT 语句。

用法：
  python scripts/migrate_dev_to_prod.py

输出：
  scripts/migrate_data.sql  — 可直接在生产 PostgreSQL 中执行的 SQL 文件

注意：
  - 脚本放在项目根目录 scripts/ 下，不在 uvicorn 监控范围内
  - SQLite 中 UUID 以 32 位 hex 存储（SqlAlchemy Uuid 类型），
    PostgreSQL 需要标准 36 位 UUID 格式（带连字符）
  - 迁移顺序按外键依赖：users → projects → questions/hypotheses/correlation_matrices/simulation_configs/reports → hypothesis_paths/datasets/reliability_results/diagnoses → diagnosis_issues
"""
import json
import sqlite3
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

DB_PATH = Path(__file__).parent.parent / "server" / "data_analysis_agent.db"
OUTPUT_PATH = Path(__file__).parent / "migrate_data.sql"


def hex_to_uuid(hex_str: str) -> str:
    """32位hex → 36位标准UUID格式（带连字符）。"""
    if not hex_str or len(hex_str) == 36:
        return hex_str
    if len(hex_str) == 32:
        return f"{hex_str[:8]}-{hex_str[8:12]}-{hex_str[12:16]}-{hex_str[16:20]}-{hex_str[20:]}"
    return hex_str


def escape_sql(s: str) -> str:
    """转义单引号。"""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def format_json(value) -> str:
    """将 JSON 值格式化为 SQL 字符串。"""
    if value is None:
        return "NULL"
    return escape_sql(json.dumps(value, ensure_ascii=False))


def format_datetime(dt_str: str) -> str:
    """格式化 datetime 为 PostgreSQL 兼容格式。"""
    if not dt_str:
        return "NULL"
    # SQLite 存储格式: 2026-07-13 10:00:00.000000
    # PostgreSQL 需要: 2026-07-13 10:00:00+00
    return escape_sql(dt_str.replace(" ", "T") + "+00")


def main():
    if not DB_PATH.exists():
        print(f"错误：数据库文件不存在: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    lines = []
    lines.append("-- 数据迁移：从开发环境 SQLite 导入生产 PostgreSQL")
    lines.append("-- 生成时间：自动")
    lines.append("-- 警告：此脚本会清空目标表后重新插入数据")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    # 1. users
    cur.execute("SELECT * FROM users")
    rows = cur.fetchall()
    if rows:
        lines.append("-- users")
        lines.append("DELETE FROM users;")
        for r in rows:
            uid = hex_to_uuid(r["id"])
            lines.append(
                f"INSERT INTO users (id, openid, nickname, avatar, plan, plan_expires_at, created_at, updated_at) "
                f"VALUES ('{uid}', {escape_sql(r['openid'])}, {escape_sql(r['nickname'])}, "
                f"{escape_sql(r['avatar'])}, {escape_sql(r['plan'])}, "
                f"{format_datetime(r['plan_expires_at'])}, "
                f"{format_datetime(r['created_at'])}, {format_datetime(r['updated_at'])});"
            )
        lines.append("")

    # 2. projects
    cur.execute("SELECT * FROM projects")
    rows = cur.fetchall()
    if rows:
        lines.append("-- projects")
        lines.append("DELETE FROM projects;")
        for r in rows:
            pid = hex_to_uuid(r["id"])
            uid = hex_to_uuid(r["user_id"])
            lines.append(
                f"INSERT INTO projects (id, user_id, name, status, created_at, updated_at) "
                f"VALUES ('{pid}', '{uid}', {escape_sql(r['name'])}, {escape_sql(r['status'])}, "
                f"{format_datetime(r['created_at'])}, {format_datetime(r['updated_at'])});"
            )
        lines.append("")

    # 3. questions
    cur.execute("SELECT * FROM questions")
    rows = cur.fetchall()
    if rows:
        lines.append("-- questions")
        lines.append("DELETE FROM questions;")
        for r in rows:
            qid = hex_to_uuid(r["id"])
            pid = hex_to_uuid(r["project_id"])
            lines.append(
                f"INSERT INTO questions (id, project_id, index, text, question_type, dimension, is_reverse, confidence, created_at) "
                f"VALUES ('{qid}', '{pid}', {r['index']}, {escape_sql(r['text'])}, "
                f"{escape_sql(r['question_type'])}, {escape_sql(r['dimension'])}, "
                f"{'TRUE' if r['is_reverse'] else 'FALSE'}, {escape_sql(r['confidence'])}, "
                f"{format_datetime(r['created_at'])});"
            )
        lines.append("")

    # 4. hypotheses
    cur.execute("SELECT * FROM hypotheses")
    rows = cur.fetchall()
    if rows:
        lines.append("-- hypotheses")
        lines.append("DELETE FROM hypotheses;")
        for r in rows:
            hid = hex_to_uuid(r["id"])
            pid = hex_to_uuid(r["project_id"])
            lines.append(
                f"INSERT INTO hypotheses (id, project_id, raw_text, created_at) "
                f"VALUES ('{hid}', '{pid}', {escape_sql(r['raw_text'])}, "
                f"{format_datetime(r['created_at'])});"
            )
        lines.append("")

    # 5. hypothesis_paths
    cur.execute("SELECT * FROM hypothesis_paths")
    rows = cur.fetchall()
    if rows:
        lines.append("-- hypothesis_paths")
        lines.append("DELETE FROM hypothesis_paths;")
        for r in rows:
            pid = hex_to_uuid(r["id"])
            hid = hex_to_uuid(r["hypothesis_id"])
            lines.append(
                f"INSERT INTO hypothesis_paths (id, hypothesis_id, predictor, outcome, direction, strength) "
                f"VALUES ('{pid}', '{hid}', {escape_sql(r['predictor'])}, "
                f"{escape_sql(r['outcome'])}, {escape_sql(r['direction'])}, {escape_sql(r['strength'])});"
            )
        lines.append("")

    # 6. correlation_matrices
    cur.execute("SELECT * FROM correlation_matrices")
    rows = cur.fetchall()
    if rows:
        lines.append("-- correlation_matrices")
        lines.append("DELETE FROM correlation_matrices;")
        for r in rows:
            mid = hex_to_uuid(r["id"])
            pid = hex_to_uuid(r["project_id"])
            lines.append(
                f"INSERT INTO correlation_matrices (id, project_id, dimensions, cells, created_at, updated_at) "
                f"VALUES ('{mid}', '{pid}', {format_json(json.loads(r['dimensions']))}, "
                f"{format_json(json.loads(r['cells']))}, "
                f"{format_datetime(r['created_at'])}, {format_datetime(r['updated_at'])});"
            )
        lines.append("")

    # 7. simulation_configs
    cur.execute("SELECT * FROM simulation_configs")
    rows = cur.fetchall()
    if rows:
        lines.append("-- simulation_configs")
        lines.append("DELETE FROM simulation_configs;")
        for r in rows:
            cid = hex_to_uuid(r["id"])
            pid = hex_to_uuid(r["project_id"])
            hid = hex_to_uuid(r["hypothesis_id"]) if r["hypothesis_id"] else "NULL"
            mid = hex_to_uuid(r["matrix_id"]) if r["matrix_id"] else "NULL"
            hid_sql = f"'{hid}'" if hid != "NULL" else "NULL"
            mid_sql = f"'{mid}'" if mid != "NULL" else "NULL"
            lines.append(
                f"INSERT INTO simulation_configs (id, project_id, sample_size, hypothesis_id, matrix_id, created_at) "
                f"VALUES ('{cid}', '{pid}', {r['sample_size']}, {hid_sql}, {mid_sql}, "
                f"{format_datetime(r['created_at'])});"
            )
        lines.append("")

    # 8. datasets
    cur.execute("SELECT * FROM datasets")
    rows = cur.fetchall()
    if rows:
        lines.append("-- datasets")
        lines.append("DELETE FROM datasets;")
        for r in rows:
            did = hex_to_uuid(r["id"])
            pid = hex_to_uuid(r["project_id"])
            cid = hex_to_uuid(r["simulation_config_id"])
            lines.append(
                f"INSERT INTO datasets (id, simulation_config_id, project_id, sample_size, columns, data, created_at) "
                f"VALUES ('{did}', '{cid}', '{pid}', {r['sample_size']}, "
                f"{format_json(json.loads(r['columns']))}, "
                f"{format_json(json.loads(r['data']))}, "
                f"{format_datetime(r['created_at'])});"
            )
        lines.append("")

    # 9. reports
    cur.execute("SELECT * FROM reports")
    rows = cur.fetchall()
    if rows:
        lines.append("-- reports")
        lines.append("DELETE FROM reports;")
        for r in rows:
            rid = hex_to_uuid(r["id"])
            pid = hex_to_uuid(r["project_id"])
            alpha = r["overall_alpha"]
            alpha_sql = f"{alpha}" if alpha is not None else "NULL"
            lines.append(
                f"INSERT INTO reports (id, project_id, overall_alpha, passed_count, total_count, created_at) "
                f"VALUES ('{rid}', '{pid}', {alpha_sql}, "
                f"{r['passed_count'] if r['passed_count'] is not None else 'NULL'}, "
                f"{r['total_count'] if r['total_count'] is not None else 'NULL'}, "
                f"{format_datetime(r['created_at'])});"
            )
        lines.append("")

    # 10. reliability_results
    cur.execute("SELECT * FROM reliability_results")
    rows = cur.fetchall()
    if rows:
        lines.append("-- reliability_results")
        lines.append("DELETE FROM reliability_results;")
        for r in rows:
            rid = hex_to_uuid(r["id"])
            rpt_id = hex_to_uuid(r["report_id"])
            lines.append(
                f"INSERT INTO reliability_results (id, report_id, dimension, alpha, kmo, bartlett_p_value, passed) "
                f"VALUES ('{rid}', '{rpt_id}', {escape_sql(r['dimension'])}, "
                f"{r['alpha']}, {r['kmo']}, {r['bartlett_p_value']}, "
                f"{'TRUE' if r['passed'] else 'FALSE'});"
            )
        lines.append("")

    # 11. diagnoses
    cur.execute("SELECT * FROM diagnoses")
    rows = cur.fetchall()
    if rows:
        lines.append("-- diagnoses")
        lines.append("DELETE FROM diagnoses;")
        for r in rows:
            did = hex_to_uuid(r["id"])
            rpt_id = hex_to_uuid(r["report_id"])
            lines.append(
                f"INSERT INTO diagnoses (id, report_id, passed, created_at) "
                f"VALUES ('{did}', '{rpt_id}', {'TRUE' if r['passed'] else 'FALSE'}, "
                f"{format_datetime(r['created_at'])});"
            )
        lines.append("")

    # 12. diagnosis_issues
    cur.execute("SELECT * FROM diagnosis_issues")
    rows = cur.fetchall()
    if rows:
        lines.append("-- diagnosis_issues")
        lines.append("DELETE FROM diagnosis_issues;")
        for r in rows:
            iid = hex_to_uuid(r["id"])
            did = hex_to_uuid(r["diagnosis_id"])
            lines.append(
                f"INSERT INTO diagnosis_issues (id, diagnosis_id, dimension, metric, value, threshold, reason, suggestion) "
                f"VALUES ('{iid}', '{did}', {escape_sql(r['dimension'])}, "
                f"{escape_sql(r['metric'])}, {r['value']}, {r['threshold']}, "
                f"{escape_sql(r['reason'])}, {escape_sql(r['suggestion'])});"
            )
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")

    conn.close()

    output = "\n".join(lines)
    OUTPUT_PATH.write_text(output, encoding="utf-8")
    print(f"迁移 SQL 已生成: {OUTPUT_PATH}")
    print(f"文件大小: {OUTPUT_PATH.stat().st_size / 1024:.1f} KB")

    # 统计
    conn2 = sqlite3.connect(str(DB_PATH))
    cur2 = conn2.cursor()
    for table in ["users", "projects", "questions", "hypotheses", "hypothesis_paths",
                   "correlation_matrices", "simulation_configs", "datasets",
                   "reports", "reliability_results", "diagnoses", "diagnosis_issues"]:
        try:
            cur2.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur2.fetchone()[0]
            print(f"  {table}: {count} 条")
        except Exception:
            print(f"  {table}: 表不存在")
    conn2.close()


if __name__ == "__main__":
    main()
