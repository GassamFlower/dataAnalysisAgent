"""错误信息集中管理（N2 整改）。

设计原则：
- 只抽取**高频复用**（>=2 次出现）或**强约束**（如配额、订阅）的错误信息为常量
- 一次性、上下文相关的错误信息保留在各调用处，避免过度抽象
- 文案变更只需修改此文件，调用方自动同步

分类：
- ERR_PROJECT_NOT_FOUND: 项目资源不存在
- ERR_USER_NOT_FOUND: 用户资源不存在
- ERR_ORDER_NOT_FOUND: 订单资源不存在
- ERR_TUTORIAL_NOT_FOUND: 教程资源不存在
- ERR_REPORT_NOT_FOUND: 报告资源不存在
- ERR_DATASET_NOT_FOUND: 数据集资源不存在
- ERR_PLAN_EXPIRED: 套餐已过期（与配额服务、支付服务、订阅校验共用）
- ERR_PLAN_REQUIRED: 需付费套餐
- ERR_PASSWORD_LENGTH: 密码长度（6~32）
- ERR_EMAIL_ALREADY_VERIFIED: 邮箱已验证
- ERR_VERIFY_CODE_EXPIRED: 验证码已过期
- ERR_VERIFY_CODE_INVALID: 验证码错误
- ERR_REFRESH_TOKEN_INVALID: refresh token 无效
- ERR_REFRESH_TOKEN_EXPIRED: refresh token 无效或已过期
- ERR_USER_LOGGED_OUT: 用户不存在或已登出

新增常量时请同步更新对应调用方，并在本文件 docstring 中登记。
"""

# ---------------------------------------------------------------------------
# 资源不存在类
# ---------------------------------------------------------------------------
ERR_PROJECT_NOT_FOUND = "项目不存在"
ERR_USER_NOT_FOUND = "用户不存在"
ERR_ORDER_NOT_FOUND = "订单不存在"
ERR_TUTORIAL_NOT_FOUND = "教程不存在"
ERR_REPORT_NOT_FOUND = "报告不存在"
ERR_DATASET_NOT_FOUND = "未找到模拟数据集，请先生成数据"

# ---------------------------------------------------------------------------
# 订阅 / 配额类（与 project_memory 中"免费用户配额"约束呼应）
# ---------------------------------------------------------------------------
ERR_PLAN_EXPIRED = "套餐已过期，请续费"
ERR_PLAN_REQUIRED = "该功能需要付费套餐（单次解锁或订阅）"

# ---------------------------------------------------------------------------
# 认证 / 凭证类
# ---------------------------------------------------------------------------
ERR_PASSWORD_LENGTH = "密码长度需在 6~32 位之间"
ERR_EMAIL_ALREADY_VERIFIED = "邮箱已验证，无需重复验证"
ERR_VERIFY_CODE_EXPIRED_REGISTER = "验证码已过期，请重新获取"
ERR_VERIFY_CODE_EXPIRED_RESEND = "验证码已过期，请重新发送"
ERR_VERIFY_CODE_INVALID = "验证码错误"
ERR_REFRESH_TOKEN_INVALID = "refresh token 无效"
ERR_REFRESH_TOKEN_EXPIRED = "refresh token 无效或已过期"
ERR_USER_LOGGED_OUT = "用户不存在或已登出"

# ---------------------------------------------------------------------------
# 微信登录未配置（出现在 login-url / callback 两处）
# ---------------------------------------------------------------------------
ERR_WECHAT_NOT_CONFIGURED_URL = "微信登录未配置，请在 .env 中设置 WECHAT_APP_ID / WECHAT_REDIRECT_URI"
ERR_WECHAT_NOT_CONFIGURED_SECRET = "微信登录未配置，请在 .env 中设置 WECHAT_APP_ID / WECHAT_APP_SECRET"
