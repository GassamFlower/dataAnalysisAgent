import type { Metadata } from "next";

import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DISCLAIMER } from "@/lib/constants";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "用户协议",
  description: "预演研究预演工作台的服务内容、账号规则、使用限制与付费说明。",
  alternates: { canonical: "/terms" },
};

const sections = [
  {
    title: "一、服务内容",
    items: [
      "本站提供问卷题目体检、模拟数据预演、统计报告、智能诊断与数据导出功能。",
      "题目体检与样本代表性诊断免费使用；数据预演、报告生成与导出按套餐开放。",
      "生成数据带有 SIMULATED 标识，仅用于研究可行性预演。",
    ],
  },
  {
    title: "二、账号规则",
    items: [
      "你需要提供真实可用的邮箱注册账号，并妥善保管密码。",
      "账号仅限本人使用，不得出租、出借或转售。",
      "因账号保管不当造成的损失由账号持有人承担。",
    ],
  },
  {
    title: "三、使用限制",
    items: [
      "不得将生成数据直接用于论文、正式研究、商业报告或对外发布。",
      "不得利用本服务伪造研究数据、代写论文或实施学术不端行为。",
      "不得上传违法、侵权、含有他人隐私或未脱敏个人信息的内容。",
      "不得对本站进行爬取、攻击、逆向工程或干扰正常服务。",
    ],
  },
  {
    title: "四、付费与退款",
    items: [
      "服务购买在小红书店铺站内完成，价格、优惠与订单状态以小红书订单页为准。",
      "下单后由客服核对订单并开通对应套餐，开通结果可在站内设置页查看。",
      "退款按小红书平台规则执行；已开始使用并产生报告或导出的订单，按平台虚拟服务规则处理。",
      "本站不直接收集支付信息，也不提供站内在线支付。",
    ],
  },
  {
    title: "五、知识产权",
    items: [
      "本站的界面、代码、统计规则与文档归运营方所有。",
      "你上传的问卷题目与文本归你所有；你授权我们在提供服务所必需的范围内处理这些内容。",
      "你基于本站生成的报告可用于学习与讨论，但不得去除 SIMULATED 标识后冒充真实研究数据。",
    ],
  },
  {
    title: "六、免责声明",
    items: [
      DISCLAIMER,
      "AI 生成的诊断建议与报告文字需人工复核，我们不保证结论适用于你的具体研究场景。",
      "因网络、设备、第三方模型服务或不可抗力导致的服务中断，我们会尽力恢复，但不承担由此产生的间接损失。",
    ],
  },
  {
    title: "七、服务变更与终止",
    items: [
      "我们可能调整功能、套餐或价格，调整前会在站内提示，已开通的套餐按开通时的约定执行。",
      "账号严重违反本协议的，我们可以暂停或终止服务。",
    ],
  },
  {
    title: "八、争议解决",
    items: [
      "本协议适用中华人民共和国法律。",
      "因本协议产生的争议，双方应先行协商；协商不成的，提交运营方所在地有管辖权的人民法院处理。",
    ],
  },
];

export default function TermsPage() {
  const contact = SITE.contactEmail || "小红书店铺客服";

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-h1 font-semibold tracking-tight text-ink-900">用户协议</h1>
        <p className="mt-3 text-body text-ink-500">
          使用本站服务前，请阅读并同意以下条款。注册、登录或购买服务即视为接受本协议。
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
              协议相关问题请联系：{contact}。
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
