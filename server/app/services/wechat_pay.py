"""微信支付 Native 扫码支付对接服务。

基于微信支付 v3 API（统一下单 Native + 回调验签 + 回调解密 + 订单查询）。
使用 httpx + cryptography 标准实现，无第三方封闭 SDK 依赖。

核心能力：
- create_native_order：统一下单（Native），返回 code_url（生成二维码）
- query_wxpay_order：订单查询（主动对账）
- verify_notify_signature：支付回调验签（平台证书公钥）
- decrypt_notify_resource：AES-256-GCM 解回调密文

金额单位：微信支付统一为「分」，服务端由「元」换算，杜绝前端改价。

凭证一律从 settings(.env) 读取，绝不硬编码其值。
风险提示：正式上线必须配置 WXPAY_PLATFORM_CERT_PATH（平台证书）用于回调验签；
未配置时生产环境默认拒绝回调（安全默认），开发环境可用自定义 dev token 简化。
"""
from __future__ import annotations

import base64
import json
import logging
import time
import uuid
from decimal import Decimal
from typing import Optional

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.x509 import load_pem_x509_certificate

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 微信支付 v3 接口地址
# ---------------------------------------------------------------------------
WXPAY_BASE = "https://api.mch.weixin.qq.com"
NATIVE_ORDER_PATH = "/v3/pay/transactions/native"
ORDER_QUERY_PATH = "/v3/pay/transactions/out-trade-no/{out_trade_no}?mchid={mchid}"


def yuan_to_fen(amount: Decimal) -> int:
    """元 → 分（微信支付要求整数分）。"""
    return int((amount * Decimal("100")).to_integral_value())


def _read_private_key() -> bytes:
    """读 apiclient_key.pem（商户私钥）。"""
    path = settings.WXPAY_MCH_PRIVATE_KEY_PATH
    if not path:
        raise RuntimeError("未配置 WXPAY_MCH_PRIVATE_KEY_PATH（商户私钥路径）")
    try:
        with open(path, "rb") as f:
            return f.read()
    except FileNotFoundError as exc:
        raise RuntimeError(f"商户私钥文件不存在: {path}") from exc


def _make_auth_headers(method: str, url_path: str, body: str = "") -> dict:
    """构造微信支付 v3 请求 Authorization 头（RSA-SHA256 签名）。"""
    private_key = serialization.load_pem_private_key(
        _read_private_key(), password=None
    )
    nonce = str(uuid.uuid4())
    timestamp = str(int(time.time()))
    message = f"{method}\n{url_path}\n{timestamp}\n{nonce}\n{body}\n"
    signature = private_key.sign(message.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
    signature_b64 = base64.b64encode(signature).decode("utf-8")
    auth = (
        'WECHATPAY2-SHA256-RSA2048 '
        f'mchid="{settings.WXPAY_MCH_ID}",'
        f'nonce_str="{nonce}",'
        f'signature="{signature_b64}",'
        f'timestamp="{timestamp}",'
        f'serial_no="{settings.WXPAY_MCH_CERT_SERIAL}"'
    )
    return {
        "Authorization": auth,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


async def create_native_order(
    out_trade_no: str,
    description: str,
    amount: Decimal,
    notify_url: str,
    attach: Optional[str] = None,
) -> str:
    """微信统一下单 Native，返回 code_url（用于前端生成二维码）。

    - out_trade_no：商户订单号（本项目用 Order.id 去连字符 hex，<=32 字符）
    - description：商品描述（如「月度订阅」）
    - amount：支付金额（元），服务端决定
    - notify_url：支付结果回调地址（HTTPS）
    """
    if not (settings.WXPAY_API_V3_KEY and settings.WXPAY_APP_ID and settings.WXPAY_MCH_ID):
        raise RuntimeError("微信支付未配置（需要 WXPAY_APP_ID / WXPAY_MCH_ID / APIv3 密钥）")

    final_notify = notify_url or settings.WXPAY_NOTIFY_URL
    body = json.dumps(
        {
            "appid": settings.WXPAY_APP_ID,
            "mchid": settings.WXPAY_MCH_ID,
            "description": description,
            "out_trade_no": out_trade_no,
            "notify_url": final_notify,
            "amount": {"total": yuan_to_fen(amount), "currency": "CNY"},
        },
        ensure_ascii=False,
    )
    headers = _make_auth_headers("POST", NATIVE_ORDER_PATH, body)

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            WXPAY_BASE + NATIVE_ORDER_PATH, headers=headers, content=body
        )
        if resp.status_code != 200:
            logger.error(
                "微信统一下单失败 HTTP %s: %s", resp.status_code, resp.text[:600]
            )
            raise RuntimeError(
                f"微信统一下单失败 HTTP {resp.status_code}: {resp.text[:600]}"
            )
        data = resp.json()
        code_url = data.get("code_url", "")
        if not code_url:
            raise RuntimeError("微信下单返回缺少 code_url")
        return code_url


async def query_wxpay_order(out_trade_no: str) -> dict:
    """查询订单（主动对账 / 前端轮询兜底）。"""
    path = ORDER_QUERY_PATH.format(
        out_trade_no=out_trade_no, mchid=settings.WXPAY_MCH_ID
    )
    headers = _make_auth_headers("GET", path)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(WXPAY_BASE + path, headers=headers)
        if resp.status_code != 200:
            raise RuntimeError(f"微信订单查询失败 {resp.status_code}: {resp.text[:400]}")
        return resp.json()


def verify_notify_signature(
    method: str,
    url_path: str,
    timestamp: str,
    nonce: str,
    body: str,
    signature: str,
) -> bool:
    """校验微信支付 v3 回调的验签。

    用平台证书公钥验签。生产若未配置 WXPAY_PLATFORM_CERT_PATH，默认拒绝（安全默认）。
    """
    cert_path = settings.WXPAY_PLATFORM_CERT_PATH
    if not cert_path:
        logger.warning("未配置 WXPAY_PLATFORM_CERT_PATH；回调验签被拒绝（安全默认）")
        return False
    try:
        with open(cert_path, "rb") as f:
            cert = load_pem_x509_certificate(f.read())
        public_key = cert.public_key()
        message = f"{method}\n{url_path}\n{timestamp}\n{nonce}\n{body}\n"
        public_key.verify(
            base64.b64decode(signature), message.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256()
        )
        return True
    except InvalidSignature:
        logger.warning("微信回调验签失败（签名不匹配）")
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("微信回调验签异常: %s", exc)
        return False


def decrypt_notify_resource(resource: dict) -> str:
    """用 APIv3 密钥解 AES-256-GCM 回调密文，返回明文 JSON 字符串。"""
    key = settings.WXPAY_API_V3_KEY
    if not key:
        raise RuntimeError("未配置 WXPAY_API_V3_KEY，无法解密回调")
    aesgcm = AESGCM(key.encode("utf-8")[:32])
    nonce = resource.get("nonce", "").encode("utf-8")
    aad = resource.get("associated_data", "").encode("utf-8")
    ciphertext = base64.b64decode(resource.get("ciphertext", ""))
    plain = aesgcm.decrypt(nonce, ciphertext, aad)
    return plain.decode("utf-8")