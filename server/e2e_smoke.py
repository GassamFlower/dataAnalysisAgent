"""端到端冒烟测试（真实进程：FastAPI :8000 + Next dev :3000）。

覆盖：
1. 前端直出页面（:3000）
2. 经 BFF 的 /api/v1 链路（前端 :3000 → :8000）
3. 后端直接用户旅程（dev-login → me → 建项目 → 列表 → 留言）
4. 管理后台旅程（临时提升 admin → users / overview / export / batch-status → 恢复）
5. 未登录访问 /admin/metrics → 中间件重定向 /login

注意：本地请求须显式 trust_env=False，否则 httpx 走系统 HTTP 栈得到 502。

运行：cd server && .venv312\\Scripts\\python.exe e2e_smoke.py
"""
import uuid

import httpx

BACKEND = "http://127.0.0.1:8000"
FRONTEND = "http://127.0.0.1:3000"
API = f"{FRONTEND}/api/v1"

PASS: list[str] = []
FAIL: list[str] = []


def check(name: str, ok: bool, detail: str = ""):
    (PASS if ok else FAIL).append(name)
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"  → {detail}" if detail and not ok else ""))


async def set_admin(dev_uid, value: bool):
    from sqlalchemy import select
    from app.core.database import async_session
    from app.models.user import User

    async with async_session() as db:
        u = (await db.execute(select(User).where(User.id == dev_uid))).scalar_one_or_none()
        if u is None:
            return False
        u.is_admin = value
        await db.commit()
        return True


async def main():
    # 本地回环请求禁用系统代理/HTTP 栈
    client = httpx.AsyncClient(trust_env=False, timeout=30.0)

    try:
        # ── 1. 公开页面（前端直出） ──
        for path, tag in [("/", "首页"), ("/login", "登录页"), ("/register", "注册页")]:
            try:
                r = await client.get(f"{FRONTEND}{path}")
                check(f"前端页面 {tag} ({path})", r.status_code == 200, f"got {r.status_code}")
            except Exception as e:
                check(f"前端页面 {tag} ({path})", False, str(e))

        # ── 2. 经 BFF 后端连通（前端 :3000 → /api/v1 公开路由 → :8000） ──
        try:
            # GET /api/v1/scales 为无需登录的公开接口，用于验证 BFF 同源转发链路
            r = await client.get(f"{API}/scales")
            ok = r.status_code == 200 and r.json().get("code") == 0
            check("BFF → 后端 /api/v1 公开链路（scales）", ok, f"got {r.status_code}: {r.text[:120]}")
        except Exception as e:
            check("BFF → 后端 /api/v1 公开链路（scales）", False, str(e))

        # ── 3. dev-login 用户旅程 ──
        tokens = None
        try:
            r = await client.post(f"{BACKEND}/api/v1/auth/dev-login")
            j = r.json()
            ok = r.status_code == 200 and j.get("code") == 0 and "access_token" in j["data"]
            tokens = j["data"]
            check("dev-login 获取 token", ok, f"got {r.status_code}: {r.text[:160]}")
        except Exception as e:
            check("dev-login 获取 token", False, str(e))

        if not tokens:
            return
        H = {"Authorization": f"Bearer {tokens['access_token']}"}

        r = await client.get(f"{BACKEND}/api/v1/users/me", headers=H)
        me = r.json()
        check("GET /users/me", r.status_code == 200 and me.get("code") == 0, r.text[:120])

        proj_id = None
        name = f"E2E冒烟-{uuid.uuid4().hex[:6]}"
        r = await client.post(f"{BACKEND}/api/v1/projects/", headers=H, json={"name": name})
        if r.status_code == 201:
            proj_id = r.json()["data"]["id"]
            check("创建项目 201", True)
        else:
            check("创建项目 201", False, f"got {r.status_code}: {r.text[:200]}")

        r = await client.get(f"{BACKEND}/api/v1/projects/", headers=H)
        if r.status_code == 200:
            names = [p.get("name") for p in r.json()["data"].get("items", [])]
            check("项目列表包含新建项目", name in names, f"list len={len(names)}")
        else:
            check("项目列表包含新建项目", False, f"got {r.status_code}")

        r = await client.post(
            f"{BACKEND}/api/v1/messages", headers=H,
            json={"tag": "feedback", "content": f"E2E 留言 {uuid.uuid4().hex[:6]}", "contact": "e2e@test.local"},
        )
        check("创建留言", r.status_code == 200, f"got {r.status_code}: {r.text[:160]}")

        # ── 4. 管理后台旅程 ──
        dev_uid = uuid.UUID("00000000-0000-0000-0000-000000000001")
        was = await set_admin(dev_uid, True)
        if not was:
            check("提升管理员（dev 用户存在）", False, "dev 用户不存在")
        else:
            try:
                r = await client.get(f"{BACKEND}/api/v1/admin/users", headers=H, params={"page": 1, "page_size": 5})
                check("后台 /admin/users 列表", r.status_code == 200, f"got {r.status_code}: {r.text[:160]}")

                r = await client.get(f"{BACKEND}/api/v1/admin/dashboard/overview", headers=H)
                check("后台 /admin/dashboard/overview", r.status_code == 200, f"got {r.status_code}: {r.text[:160]}")

                r = await client.post(f"{BACKEND}/api/v1/admin/users/export", headers=H, json={})
                ok = r.status_code == 200 and r.content.startswith(b"\xef\xbb\xbf")
                check("后台导出 CSV（BOM）", ok, f"got {r.status_code} len={len(r.content)}")

                ids = []
                for i in range(2):
                    m = (await client.post(
                        f"{BACKEND}/api/v1/messages", headers=H,
                        json={"tag": "feedback", "content": f"batch {i} {uuid.uuid4().hex[:6]}"},
                    )).json()["data"]
                    ids.append(m["id"])
                r = await client.patch(
                    f"{BACKEND}/api/v1/admin/messages/batch-status", headers=H,
                    json={"message_ids": ids, "status": "done"},
                )
                j = r.json()
                check("批量留言标记 done", r.status_code == 200 and j["data"]["updated"] == 2, r.text[:160])
            finally:
                await set_admin(dev_uid, False)

        # ── 5. 未登录访问后台 → /login ──
        try:
            r = await client.get(f"{FRONTEND}/admin/metrics", follow_redirects=False)
            loc = r.headers.get("location") or ""
            check("未登录 /admin/metrics → /login", r.status_code in (307, 302) and "/login" in loc,
                  f"status={r.status_code} loc={loc}")
        except Exception as e:
            check("未登录 /admin/metrics → /login", False, str(e))
    finally:
        await client.aclose()

    print("\n" + "=" * 56)
    print(f"E2E 结果：{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("失败项：")
        for f in FAIL:
            print("  -", f)
    print("=" * 56)


if __name__ == "__main__":
    import anyio

    anyio.run(main)
