"use client";

import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";

import { ContactForm } from "@/components/contact/contact-form";
import { WechatEntry } from "@/components/contact/wechat-entry";
import { DISCLAIMER } from "@/lib/constants";
import { SITE } from "@/lib/site-config";

const productLinks = [
  { href: "/", label: "首页" },
  { href: "/example", label: "样例报告" },
  { href: "/pricing", label: "服务价格" },
  { href: "/learn", label: "统计小课堂" },
];

const legalLinks = [
  { href: "/terms", label: "用户协议" },
  { href: "/privacy", label: "隐私政策" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-cream-surface/50">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900 text-background">
              <FileText className="h-4 w-4" />
            </span>
            <span className="text-body font-semibold text-ink-900">{SITE.name}</span>
          </div>
          <p className="mt-3 max-w-xs text-small leading-relaxed text-ink-500">
            {SITE.tagline}。回收前先预演，回收后看懂样本，所有生成数据仅用于研究可行性预演。
          </p>
          <p className="mt-4 flex items-start gap-1.5 text-caption text-ink-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            本报告部分内容由 AI 辅助生成，结论需人工复核。
          </p>
        </div>

        <div>
          <h3 className="text-caption font-medium uppercase tracking-[0.08em] text-ink-400">
            产品
          </h3>
          <ul className="mt-3 space-y-2 text-small text-ink-700">
            {productLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-ink-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-caption font-medium uppercase tracking-[0.08em] text-ink-400">
            支持与条款
          </h3>
          <ul className="mt-3 space-y-2 text-small text-ink-700">
            <li>
              <WechatEntry
                trigger={
                  <span className="cursor-pointer select-none transition-colors hover:text-ink-900">
                    客服微信
                  </span>
                }
              />
            </li>
            <li>
              <ContactForm
                variant="sheet"
                entryPoint="footer"
                trigger={
                  <span className="cursor-pointer select-none transition-colors hover:text-ink-900">
                    留言反馈
                  </span>
                }
              />
            </li>
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-ink-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-caption text-ink-500 md:col-span-3">
          {DISCLAIMER}
        </div>

        <div className="col-span-2 flex flex-col gap-2 text-caption text-ink-400 md:col-span-3 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.entity}
            {SITE.icp ? ` · ${SITE.icp}` : ""}
            {SITE.police ? ` · ${SITE.police}` : ""}
            {SITE.businessLicense ? ` · 营业执照 ${SITE.businessLicense}` : ""}
          </p>
          {SITE.contactEmail ? (
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="transition-colors hover:text-ink-700"
            >
              {SITE.contactEmail}
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
