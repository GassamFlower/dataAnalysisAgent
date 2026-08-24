"""管理员晋升 CLI（管理后台 bootstrap，立项 G1）。

用法（在 server/ 目录下）：
    python -m scripts.promote_admin admin@example.com other@example.com
    python -m scripts.promote_admin --emails a@x.com,b@y.com

将指定邮箱对应的账号 is_admin 置 True；不存在则跳过。
"""
import asyncio
import sys

from sqlalchemy import func, select

from app.core.database import async_session
from app.models.user import User


async def promote(emails) -> int:
    promoted = 0
    async with async_session() as db:
        for raw in emails:
            email = (raw or "").strip().lower()
            if not email:
                continue
            res = await db.execute(select(User).where(func.lower(User.email) == email))
            user = res.scalar_one_or_none()
            if not user:
                print(f"  [跳过] 邮箱不存在: {email}")
                continue
            if user.is_admin:
                print(f"  [已是] {email}")
                continue
            user.is_admin = True
            promoted += 1
            print(f"  [晋升] {email}")
        await db.commit()
    return promoted


def _main() -> None:
    args = [a for a in sys.argv[1:] if "@" in a]
    if not args:
        print(__doc__)
        sys.exit(1)
    n = asyncio.run(promote(args))
    print(f"完成：晋升 {n} 个管理员。")


if __name__ == "__main__":
    _main()