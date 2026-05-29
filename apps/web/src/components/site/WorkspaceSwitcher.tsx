"use client";

import * as React from "react";
import { ChevronsUpDown, Check } from "lucide-react";

export interface WorkspaceSwitcherItem {
  id: string;
  name: string;
  role: string;
}

export function WorkspaceSwitcher({
  current,
  options,
}: {
  current: WorkspaceSwitcherItem;
  options: WorkspaceSwitcherItem[];
}) {
  const [open, setOpen] = React.useState(false);
  if (options.length <= 1) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-body-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span className="truncate max-w-[160px]">{current.name}</span>
        <ChevronsUpDown className="size-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((w) => (
            <form
              key={w.id}
              action="/api/auth/workspace-switch"
              method="post"
              className="m-0"
            >
              <input type="hidden" name="workspace_id" value={w.id} />
              <input type="hidden" name="redirect" value="/dashboard" />
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-body-sm hover:bg-slate-100"
              >
                <span>
                  <div className="font-medium text-slate-900">{w.name}</div>
                  <div className="text-caption text-slate-500">{w.role}</div>
                </span>
                {w.id === current.id && (
                  <Check className="size-4 text-signal-600" />
                )}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
