import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../../primitives/avatar";
import { BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";

export interface TrustTeamContent {
  headline?: string;
  members: Array<{ name: string; title?: string; bio?: string; photo_asset_id?: AssetId }>;
}

export interface TrustTeamProps extends BlockBaseProps {
  content: TrustTeamContent;
}

export function TrustTeam({ content, sectionId, resolveAsset, styleOverrides }: TrustTeamProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="trust.team" styleOverrides={styleOverrides}>
      {content.headline && <h2 className="text-center font-display text-h2 font-semibold text-slate-900">{content.headline}</h2>}
      <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.members.map((m, i) => {
          const a = m.photo_asset_id ? resolveAsset?.(m.photo_asset_id) : undefined;
          return (
            <li key={i} className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <Avatar className="mx-auto h-20 w-20">
                {a && <AvatarImage src={a.url} alt="" />}
                <AvatarFallback>{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="mt-4 font-semibold text-slate-900">{m.name}</div>
              {m.title && <div className="text-caption text-slate-500">{m.title}</div>}
              {m.bio && <p className="mt-3 text-body-sm text-slate-600">{m.bio}</p>}
            </li>
          );
        })}
      </ul>
    </BlockShell>
  );
}
