"""支付宝当面付（扫码支付）对接服务。

基于支付宝开放平台 API（alipay.trade.precreate 预下单 + 回调验签 + 订单查询）。
使用 httpx + cryptography 标准实现。

核心能力：
- create_precreate_order：预下单（当面付），返回 qr_code（生成二维码）
- query_alipay_order：订单查询（主动对账）
- verify_notify_signature：支付回调验签（支付宝公钥）

金额单位：支付宝统一为「元」（字符串，保留两位小数），服务端由 Decimal 转换。

凭证一律从 settings(.env) 读取，绝不硬编码其值。
"""
from __future__ import annotations

import base64
import json
import logging
import time
import uuid
from decimal import Decimal
from typing import Optional
from urllib.parse import quote_plus

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, utils

from app.core.config import settings

logger = logging.getLogger(__name__)


def _load_private_key() -> bytes:
    """加载应用私钥（PEM 格式）。

    支持两种配置方式：
    1. ALIPAY_APP_PRIVATE_KEY 为文件路径 → 读取文件内容
    2. ALIPAY_APP_PRIVATE_KEY 为 PEM 内容 → 直接使用
    """
    key_config = settings.ALIPAY_APP_PRIVATE_KEY
    if not key_config:
        raise RuntimeError("未配置 ALIPAY_APP_PRIVATE_KEY（支付宝应用私钥）")

    # 判断是文件路径还是 PEM 内容
    if key_config.startswith("-----BEGIN"):
        return key_config.encode("utf-8")
    else:
        # 当作文件路径
        try:
            with open(key_config, "rb") as f:
                return f.read()
        except FileNotFoundError as exc:
            raise RuntimeError(f"支付宝应用私钥文件不存在: {key_config}") from exc


def _sign_content(content: str) -> str:
    """使用 RSA2 (SHA256WithRSA) 对内容签名。"""
    private_key_pem = _load_private_key()
    private_key = serialization.load_pem_private_key(private_key_pem, password=None)
    signature = private_key.sign(
        content.encode("utf-8"),
        padding.PKCS1v15(),
        utils.Prehashed(hashes.SHA256().digest()),
    )
    return base64.b64encode(signature).decode("utf-8")


def _build_common_params(biz_content: dict, method: str) -> dict:
    """构造支付宝公共请求参数。"""
    params = {
        "app_id": settings.ALIPAY_APP_ID,
        "method": method,
        "format": "JSON",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "biz_content": json.dumps(biz_content, ensure_ascii=False),
    }
    if settings.ALIPAY_NOTIFY_URL:
        params["notify_url"] = settings.ALIPAY_NOTIFY_URL

    # 生成签名
    sign_content = "&".join(f"{k}={quote_plus(v)}" for k, v in sorted(params.items()) if v)
    params["sign"] = _sign_content(sign_content)
    return params


async def create_precreate_order(
    out_trade_no: str,
    total_amount: Decimal,
    subject: str,
    notify_url: Optional[str] = None,
) -> str:
    """支付宝预下单（当面付），返回 qr_code（用于前端生成二维码）。

    - out_trade_no：商户订单号（本项目用 Order.id）
    - total_amount：订单金额（元），服务端决定
    - subject：订单标题（如「单次预演」）
    - notify_url：异步通知地址（可选，覆盖默认配置）
    """
    if not (settings.ALIPAY_APP_ID and settings.ALIPAY_APP_PRIVATE_KEY):
        raise RuntimeError("支付宝未配置（需要 ALIPAY_APP_ID / ALIPAY_APP_PRIVATE_KEY）")

    biz_content = {
        "out_trade_no": out_trade_no,
        "total_amount": str(total_amount.quantize(Decimal("0.01"))),
        "subject": subject,
    }
    if notify_url:
        biz_content["notify_url"] = notify_url

    params = _build_common_params(biz_content, "alipay.trade.precreate")

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(settings.ALIPAY_GATEWAY, data=params)
        if resp.status_code != 200:
            logger.error(
                "支付宝预下单失败 HTTP %s: %s", resp.status_code, resp.text[:600]
            )
            raise RuntimeError(
                f"支付宝预下单失败 HTTP {resp.status_code}: {resp.text[:600]}"
            )
        data = resp.json()
        alipay_resp = data.get("alipay_trade_precreate_response", {})
        code = alipay_resp.get("code", "")
        if code != "10000":
            msg = alipay_resp.get("sub_msg") or alipay_resp.get("msg", "未知错误")
            raise RuntimeError(f"支付宝预下单失败: {msg}")
        qr_code = alipay_resp.get("qr_code", "")
        if not qr_code:
            raise RuntimeError("支付宝预下单返回缺少 qr_code")
        return qr_code


async def query_alipay_order(out_trade_no: str) -> dict:
    """查询订单（主动对账 / 前端轮询兜底）。"""
    biz_content = {"out_trade_no": out_trade_no}
    params = _build_common_params(biz_content, "alipay.trade.query")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(settings.ALIPAY_GATEWAY, data=params)
        if resp.status_code != 200:
            raise RuntimeError(f"支付宝订单查询失败 {resp.status_code}: {resp.text[:400]}")
        data = resp.json()
        return data.get("alipay_trade_query_response", {})


def verify_notify_signature(params: dict, signature: str) -> bool:
    """校验支付宝回调的验签。

    用支付宝公钥验签（RSA2 = SHA256WithRSA）。
    """
    alipay_public_key_pem = settings.ALIPAY_ALIPAY_PUBLIC_KEY
    if not alipay_public_key_pem:
        logger.warning("未配置 ALIPAY_ALIPAY_PUBLIC_KEY；回调验签被拒绝（安全默认）")
        return False

    try:
        # 构造待验签内容（按 key 排序，排除 sign 和 sign_type）
        sign_content = "&".join(
            f"{k}={quote_plus(v)}"
            for k, v in sorted(params.items())
            if k not in ("sign", "sign_type") and v
        )

        # 加载支付宝公钥
        if alipay_public_key_pem.startswith("-----BEGIN"):
            public_key_pem = alipay_public_key_pem.encode("utf-8")
        else:
            # 如果是文件路径
            with open(alipay_public_key_pem, "rb") as f:
                public_key_pem = f.read()

        public_key = serialization.load_pem_public_key(public_key_pem)
        public_key.verify(
            base64.b64decode(signature),
            sign_content.encode("utf-8"),
            padding.PKCS1v15(),
            utils.Prehashed(hashes.SHA256().digest()),
        )
        return True
    except Exception as exc:
        logger.warning("支付宝回调验签失败: %s", exc)
        return False
