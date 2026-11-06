import type { Metadata } from "next";

import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "隐私政策",
  description: "预演研究预演工作台的个人信息收集、使用、存储与删除规则。",
  alternates: { canonical: "/privacy" },
};

const sections = [
  {
    title: "一、我们收集哪些信息",
    items: [
      "账号信息：邮箱地址、昵称、头像、密码哈希值。密码以不可逆哈希保存，我们无法查看明文。",
      "业务数据：项目名称、问卷题目文本、你主动上传的问卷星或 SPSS 文件、系统生成的模拟数据与报告。",
      "使用记录：登录时间、访问页面、操作类型、IP 地址与浏览器信息，用于安全审计和故障排查。",
      "沟通记录：你通过留言表单或客服渠道提交的内容。",
    ],
  },
  {
    title: "二、信息如何使用",
    items: [
      "提供题目体检、数据预演、统计报告、诊断建议与导出功能。",
      "保障账号安全，识别异常登录与滥用行为。",
      "在你主动提交留言或求助时，回复并跟进问题。",
      "改进产品体验与统计功能可用性，不用于广告画像。",
    ],
  },
  {
    title: "三、第三方服务",
    items: [
      "AI 模型服务：题目解析、诊断建议与报告润色会调用境内大模型接口（DeepSeek、Kimi、通义千问）。传输内容为问卷题目与假设文本，不包含你的邮箱、昵称和密码。",
      "邮件服务：注册验证、找回密码、邮箱变更通知通过 SMTP 邮件服务发送。",
      "成交渠道：服务购买在小红书站内完成，支付信息由小红书平台处理，我们不收集你的银行卡或支付账号。",
    ],
  },
  {
    title: "四、存储与保留",
    items: [
      "账号与业务数据存储在中华人民共和国境内的服务器。",
      "账号存续期间保留业务数据；账号注销后 30 日内删除或匿名化，法律法规另有规定的除外。",
      "安全审计日志保留 180 日，到期自动清理。",
    ],
  },
  {
    title: "五、你的权利",
    items: [
      "你可以查询、更正昵称、头像与邮箱，也可以在设置页修改密码。",
      "你可以要求删除项目、问卷与报告数据，或申请注销账号。",
      "你可以撤回对非必要信息处理的同意，撤回后不影响此前已完成的处理。",
      "行使上述权利请通过页脚联系方式与我们联系，我们会在 15 个工作日内答复。",
    ],
  },
  {
    title: "六、Cookie 与本地存储",
    items: [
      "站点使用 Cookie 与浏览器本地存储保存登录凭证和界面偏好。",
      "登录凭证用于维持会话；清除浏览器数据后需要重新登录。",
      "我们不使用第三方广告 Cookie。",
    ],
  },
  {
    title: "七、未成年人保护",
    items: [
      "本服务面向高校学生与研究人员。不满 14 周岁的未成年人使用时，应由监护人陪同并同意本政策。",
    ],
  },
  {
    title: "八、政策更新",
    items: [
      "本政策更新后会在本页发布，重大变更会在站内提示。",
    ],
  },
];

export default function PrivacyPage() {
  const contact = SITE.contactEmail || "小红书店铺客服";

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-h1 font-semibold tracking-tight text-ink-900">隐私政策</h1>
        <p className="mt-3 text-body text-ink-500">
          {SITE.entity}（以下简称“我们”）说明本站在提供研究预演服务时如何收集、使用、存储和保护你的信息。
        </p>
        <p className="mt-1 text-caption text-ink-400">更新日期：2026 年 11 月 6 日</p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-h3 font-semibold text-ink-900">{section.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2 text-body leading-relaxed text-ink-700">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section>
            <h2 className="text-h3 font-semibold text-ink-900">九、联系我们</h2>
            <p className="mt-3 text-body text-ink-700">
              隐私相关问题请联系：{contact}。我们会在收到请求后尽快处理。
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
