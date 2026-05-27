"use client";

import { Check, Link2, Twitter } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/Button";

interface ShareBarProps {
  shareCode: string;
  scoreOverall: number;
  hostname: string;
}

export function ShareBar({ shareCode, scoreOverall, hostname }: ShareBarProps) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/grade/s/${shareCode}`
      : `https://gofunnelai.com/grade/s/${shareCode}`;
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  };

  const tweet = () => {
    const text = encodeURIComponent(
      `I scored ${scoreOverall}/100 on the free GoFunnelAI audit for ${hostname}. What'd you get? ${shareUrl}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-900/50">Share your score</div>
        <div className="mt-1 truncate font-mono text-sm text-ink-900/80">{shareUrl}</div>
      </div>
      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? (
          <>
            <Check className="mr-2 h-4 w-4" /> Copied
          </>
        ) : (
          <>
            <Link2 className="mr-2 h-4 w-4" /> Copy link
          </>
        )}
      </Button>
      <Button variant="secondary" size="sm" onClick={tweet}>
        <Twitter className="mr-2 h-4 w-4" /> Tweet it
      </Button>
    </div>
  );
}
