"""数据库连接配置。"""
import logging
from typing import Optional

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

# SQLite 不需要连接池参数
engine_kwargs = {
    "echo": settings.DEBUG,
}

if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_pre_ping"] = True

# 创建异步引擎
engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)


# SQLite 性能优化：每次连接时设置 WAL 模式 + busy_timeout
# WAL 允许并发读写，避免 "database is locked" 错误
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

# 创建异步会话工厂
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    """获取数据库会话（依赖注入）。"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """初始化数据库（创建缺失的表，并将模型中新增的列同步到已存在的表）。

    说明：
    - 对全新数据库：create_all 会按模型建表，无需额外处理。
    - 对已存在的数据库（早期由 create_all 引导、未走 Alembic 全链，
      或已跑过 alembic 但缺少新增列）：create_all 不会给已存在的表补列，
      例如教程表新增的 `tags` / `difficulty` 列。这里统一做一次「缺列补列」，
      幂等、跨 SQLite / PostgreSQL 通用，避免启动后因列缺失抛 500。
    """
    from app.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 对已存在但缺列的表补齐列（幂等）
        await conn.run_sync(_sync_missing_columns, Base)


def _sync_missing_columns(sync_conn, base) -> None:
    """比对各表当前声明列与数据库实际列，为已存在的表补齐缺失列（幂等）。"""
    from sqlalchemy import inspect as sa_inspect

    inspector = sa_inspect(sync_conn)
    db_tables = set(inspector.get_table_names())

    for table in base.metadata.sorted_tables:
        if table.name not in db_tables:
            continue
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        missing_cols = [
            col for col in table.columns
            if col.name not in existing_cols and not col.primary_key
        ]
        for col in missing_cols:
            # 生成与 CREATE TABLE 一致的列定义（类型 + 可空性）
            col_type = col.type.compile(dialect=sync_conn.dialect)
            nullability = "NULL" if col.nullable else "NOT NULL"
            ddl = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type} {nullability}"
            # SQLite：给已存在数据的表新增 NOT NULL 列必须带 DEFAULT，否则报
            # "Cannot add a NOT NULL column with default value NULL"。
            # 优先用模型声明的 server_default；否则回退到 Python 默认值字面量。
            if not col.nullable:
                default_sql = _default_sql(col)
                if default_sql is not None:
                    ddl = f"{ddl} DEFAULT {default_sql}"
            # 用 SAVEPOINT（nested）隔离每条 ALTER：PG 中任何一条 DDL 报错都会
            # 置整个事务为 aborted，导致后续所有语句继续抛
            # "current transaction is aborted"。nested 让单列失败可回滚到保存点，
            # 不污染同一事务里的其它列/表。
            try:
                with sync_conn.begin_nested():
                    sync_conn.execute(text(ddl))
                logger.info(
                    f"已为表 {table.name} 补齐缺失列 {col.name} ({col_type})"
                )
            except Exception as e:  # noqa: BLE001 幂等/并发下容忍重复添加
                logger.warning(
                    f"补齐列 {table.name}.{col.name} 失败（可忽略）: {e}"
                )


def _default_sql(col) -> Optional[str]:
    """为非空列推导可写入 SQL 的 DEFAULT 字面量。

    优先使用模型 ServerDefault；否则用 Python 默认值（bool/int/str）转成字面量。
    无法推导时返回 None（调用方此时不加 DEFAULT，交由上层兜底/报错）。
    """
    from sqlalchemy import String, Boolean, Integer

    # 1) server_default（如 server_default="0"）
    sd = getattr(col, "server_default", None)
    if sd is not None:
        arg = getattr(sd, "arg", None)
        if arg is not None:
            return str(arg) if not isinstance(arg, str) else _quote_default(arg)

    # 2) Python 默认值
    dflt = getattr(col, "default", None)
    if dflt is not None:
        arg = getattr(dflt, "arg", dflt)
        if isinstance(arg, bool):
            # PostgreSQL 中 `DEFAULT 0/1` 对 BOOLEAN 列会报
            # "column is of type boolean but default is of type integer"；
            # 用 TRUE/FALSE 字面量，SQLite 与 PostgreSQL 均接受。
            return "TRUE" if arg else "FALSE"
        if isinstance(col.type, Integer):
            return str(int(arg if arg is not None else 0))
        if isinstance(arg, str):
            return _quote_default(arg)
    return None


def _quote_default(value: str) -> str:
    """把字符串默认值包成 SQL 单引号字面量（转义单引号）。"""
    return "'" + value.replace("'", "''") + "'"


async def close_db():
    """关闭数据库连接。"""
    await engine.dispose()
