import * as React from "react";
import { Play } from "lucide-react";
import { cn } from "../../lib/cn";
import { BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";

/**
 * content.video-embed — A video (asset_id or external url) with optional poster.
 * Doc 18 B.6.3.
 */
export interface ContentVideoEmbedContent {
  video_asset_id?: AssetId;
  provider?: "youtube" | "vimeo" | "wistia" | "loom" | "self_hosted";
  external_url?: string;
  poster_asset_id?: AssetId;
  autoplay_muted_loop?: boolean;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:5";
  caption?: string;
}

export interface ContentVideoEmbedProps extends BlockBaseProps {
  content: ContentVideoEmbedContent;
}

const ASPECT: Record<NonNullable<ContentVideoEmbedContent["aspect_ratio"]>, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
};

function embedUrl(provider: ContentVideoEmbedContent["provider"], url: string): string {
  try {
    const u = new URL(url);
    if (provider === "youtube") {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? "";
      return `https://www.youtube.com/embed/${id}`;
    }
    if (provider === "vimeo") {
      const id = u.pathname.split("/").pop() ?? "";
      return `https://player.vimeo.com/video/${id}`;
    }
    if (provider === "loom") {
      const id = u.pathname.split("/").pop() ?? "";
      return `https://www.loom.com/embed/${id}`;
    }
    return url;
  } catch {
    return url;
  }
}

export function ContentVideoEmbed({ content, sectionId, resolveAsset, styleOverrides }: ContentVideoEmbedProps): JSX.Element {
  const aspect = ASPECT[content.aspect_ratio ?? "16:9"];
  const videoAsset = content.video_asset_id ? resolveAsset?.(content.video_asset_id) : undefined;
  const posterAsset = content.poster_asset_id ? resolveAsset?.(content.poster_asset_id) : undefined;
  const [playing, setPlaying] = React.useState(content.autoplay_muted_loop ?? false);

  return (
    <BlockShell sectionId={sectionId} sectionType="content.video-embed" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-4xl">
        <div className={cn("relative w-full overflow-hidden rounded-xl bg-slate-900 shadow-xl", aspect)}>
          {videoAsset?.url ? (
            <video
              src={videoAsset.url}
              poster={posterAsset?.url}
              controls={!content.autoplay_muted_loop}
              autoPlay={content.autoplay_muted_loop}
              muted={content.autoplay_muted_loop}
              loop={content.autoplay_muted_loop}
              playsInline
              className="h-full w-full object-cover"
            />
          ) : content.external_url ? (
            playing ? (
              <iframe
                src={embedUrl(content.provider, content.external_url)}
                title="Embedded video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="group absolute inset-0 flex h-full w-full items-center justify-center bg-slate-900"
                aria-label="Play video"
              >
                {posterAsset ? (
                  <BlockImage asset={posterAsset} className="absolute inset-0 h-full w-full opacity-80" decorative />
                ) : null}
                <span className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-110">
                  <Play className="ml-1 h-8 w-8 fill-signal-700 text-signal-700" />
                </span>
              </button>
            )
          ) : posterAsset ? (
            <BlockImage asset={posterAsset} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500">No video source</div>
          )}
        </div>
        {content.caption && <p className="mt-3 text-center text-caption text-slate-500">{content.caption}</p>}
      </div>
    </BlockShell>
  );
}
