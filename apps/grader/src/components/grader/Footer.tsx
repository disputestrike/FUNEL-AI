import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-ink-50/60">
      <div className="container py-10 text-sm text-ink-900/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" aria-label="GoFunnelAI home" className="inline-flex items-center">
              <Image
                src="/brand/logos/funelai_primary_logo.png"
                alt="GoFunnelAI"
                width={144}
                height={36}
                priority
                style={{ height: 36, width: "auto" }}
              />
            </Link>
            <div className="mt-1 text-xs">Autonomous lead generation â€” coming soon.</div>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/grade" className="hover:text-ink-900">Grade a page</Link>
            <Link href="/grade/learn/how-we-score" className="hover:text-ink-900">How we score</Link>
            <Link href="/privacy" className="hover:text-ink-900">Privacy</Link>
            <Link href="/terms" className="hover:text-ink-900">Terms</Link>
          </nav>
        </div>
        <p className="mt-6 text-[11px] text-ink-900/40">
          The compliance flag is informational only and is not legal advice.
        </p>
      </div>
    </footer>
  );
}
