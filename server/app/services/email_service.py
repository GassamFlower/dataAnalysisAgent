"""邮件发送服务（SMTP）。

用于发送邮箱验证码和密码重置链接邮件。
SMTP 配置在 .env 中：SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

from app.core.config import settings


def _check_smtp_configured() -> bool:
    """检查 SMTP 是否已配置。"""
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    """发送 HTML 邮件。

    Args:
        to_email: 收件人邮箱
        subject: 邮件主题
        html_body: HTML 邮件正文

    Raises:
        RuntimeError: SMTP 未配置或发送失败
    """
    if not _check_smtp_configured():
        raise RuntimeError("SMTP 未配置，请在 .env 中设置 SMTP_HOST / SMTP_USER / SMTP_PASSWORD")

    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_USER))
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # SSL 连接（端口 465）或 TLS 连接（端口 587）
    if settings.SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
        server.starttls()

    try:
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
    finally:
        server.quit()


def send_verification_code(to_email: str, code: str) -> None:
    """发送邮箱验证码邮件。

    Args:
        to_email: 收件人邮箱
        code: 6 位验证码
    """
    html = f"""
    <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2a2520;">
        <h2 style="color:#2a2520;border-bottom:2px solid #e8e0d5;padding-bottom:12px;">预演 - 邮箱验证</h2>
        <p>您好，感谢注册「预演」。</p>
        <p>您的验证码是：</p>
        <div style="text-align:center;margin:24px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#8b6f47;background:#faf8f3;padding:12px 24px;border-radius:8px;">{code}</span>
        </div>
        <p style="color:#6b6157;font-size:14px;">验证码 10 分钟内有效，请尽快输入。</p>
        <p style="color:#9b9088;font-size:12px;margin-top:32px;border-top:1px solid #e8e0d5;padding-top:12px;">
            如果这不是您本人的操作，请忽略此邮件。<br/>
            预演 - 问卷研究预演工具
        </p>
    </div>
    """
    _send_email(to_email, "【预演】邮箱验证码", html)


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """发送密码重置链接邮件。

    Args:
        to_email: 收件人邮箱
        reset_link: 重置密码链接（含 JWT token）
    """
    html = f"""
    <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2a2520;">
        <h2 style="color:#2a2520;border-bottom:2px solid #e8e0d5;padding-bottom:12px;">预演 - 重置密码</h2>
        <p>您好，我们收到了您重置密码的请求。</p>
        <p>请点击下方按钮重置您的密码：</p>
        <div style="text-align:center;margin:24px 0;">
            <a href="{reset_link}" style="display:inline-block;background:#8b6f47;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:16px;">重置密码</a>
        </div>
        <p style="color:#6b6157;font-size:14px;">链接 30 分钟内有效。</p>
        <p style="color:#6b6157;font-size:14px;">如果按钮无法点击，请复制以下链接到浏览器：</p>
        <p style="word-break:break-all;color:#8b6f47;font-size:13px;">{reset_link}</p>
        <p style="color:#9b9088;font-size:12px;margin-top:32px;border-top:1px solid #e8e0d5;padding-top:12px;">
            如果这不是您本人的操作，请忽略此邮件，您的密码不会被更改。<br/>
            预演 - 问卷研究预演工具
        </p>
    </div>
    """
    _send_email(to_email, "【预演】重置密码", html)
