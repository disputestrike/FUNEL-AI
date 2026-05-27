import Link from "next/link";
import { Github, Linkedin, Twitter, Youtube } from "lucide-react";
import { Lockup } from "@/components/brand/Wordmark";

/**
 * Site footer.
 *
 * Copy is verbatim from doc 10 section 1.7 - including the
 * "Made by humans + AI" disclosure line at the bottom.
 */
const COLUMNS = [
  {
    title: "Product",
    items: [
      { label: "Generate", href: "/#how-it-works" },
      { label: "Funnel Grader", href: "/grade" },
      { label: "Pricing", href: "/pricing" },
      { label: "Industries", href: "/industries" },
      { label: "Integrations", href: "/integrations" },
      { label: "Roadmap", href: "/roadmap" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "Funnel Academy", href: "/academy" },
      { label: "Help Center", href: "/help" },
      { label: "Blog", href: "/blog" },
      { label: "Community", href: "/community" },
      { label: "Funnel Awards", href: "/awards" },
      { label: "FunnelCon", href: "/funnelcon" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Acceptable Use Policy", href: "/legal/aup" },
      { label: "Refund Policy", href: "/legal/refund" },
      { label: "Subprocessors", href: "/legal/subprocessors" },
      { label: "Cookie Settings", href: "/legal/cookies" },
    ],
  },
];

const SOCIAL = [
  { label: "X", href: "https://x.com/gofunnelai", Icon: Twitter },
  { label: "LinkedIn", href: "https://linkedin.com/company/gofunnelai", Icon: Linkedin },
  { label: "YouTube", href: "https://youtube.com/@gofunnelai", Icon: Youtube },
  { label: "GitHub", href: "https://github.com/gofunnelai", Icon: Github },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <div className="container py-16">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Lockup />
            <p className="text-body-sm text-slate-500 max-w-xs">
              Autonomous lead generation. Type your business - get a customer.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-caption font-semibold uppercase tracking-wider text-slate-500 mb-3">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-body-sm text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-8 md:flex-row md:items-center md:justify-between dark:border-slate-700">
          <div className="flex items-center gap-3">
            {SOCIAL.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="inline-flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700"
                target="_blank"
                rel="noreferrer noopener"
              >
                <Icon className="size-5" />
              </a>
            ))}
          </div>
          <p className="text-body-sm text-slate-500">
            (c) 2026 GoFunnelAI, Inc. - San Francisco - Lagos - Remote everywhere else.
          </p>
        </div>

        <p className="mt-6 text-center text-caption text-slate-500">
          Made by humans + AI. The humans wrote the AI. The AI helped write this footer. Both are
          accountable. Both are reachable: {" "}
          <a href="mailto:hello@gofunnelai.com" className="underline underline-offset-2">
            hello@gofunnelai.com
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
