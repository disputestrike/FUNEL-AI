import * as React from "react";
import { MessageSquare } from "lucide-react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface InteractiveLiveChatEmbedContent {
  headline?: string;
  provider: "intercom" | "drift" | "tidio" | "crisp" | "custom";
  inline_html?: string;
  cta_label?: string;
}

export interface InteractiveLiveChatEmbedProps extends BlockBaseProps {
  content: InteractiveLiveChatEmbedContent;
}

export function InteractiveLiveChatEmbed({ content, sectionId, styleOverrides }: InteractiveLiveChatEmbedProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="interactive.live-chat-embed" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <MessageSquare className="mx-auto h-10 w-10 text-signal-600" />
        {content.headline && <h2 className="mt-4 font-display text-h3 font-semibold text-slate-900">{content.headline}</h2>}
        <p className="mt-2 text-caption text-slate-500">Live chat ({content.provider}) — appears on the live page.</p>
        {content.inline_html ? (
          <div
            className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-left text-caption text-slate-600"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: content.inline_html }}
          />
        ) : (
          <button
            type="button"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-signal-500 px-6 py-3 font-semibold text-white shadow-sm hover:bg-signal-600"
          >
            <MessageSquare className="h-4 w-4" />
            {content.cta_label ?? "Start a chat"}
          </button>
        )}
      </div>
    </BlockShell>
  );
}
