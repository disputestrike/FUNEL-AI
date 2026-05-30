/**
 * TanStack Table wrapper for audit-log style data.
 *
 * Used in:
 *  - /audit-log (global)
 *  - /customers/[workspaceId] → Audit log tab
 *  - any place we list `admin_action_log` rows
 *
 * Features:
 *  - Sortable columns
 *  - Per-column free-text filter (top of column)
 *  - Pagination (10 / 25 / 50 / 100)
 *  - "Export visible" → CSV download (only the filtered+sorted rows the
 *    user can currently see)
 *  - Compact monospace rendering for ids
 */

"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { cn } from "@/lib/cn";

export interface AuditLogRow {
  id: string;
  timestamp: string; // ISO
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string;
  workspace_id: string | null;
  ticket_id: string | null;
  status: "succeeded" | "failed" | "started";
  reason: string;
}

export interface AuditLogTableProps {
  rows: AuditLogRow[];
  /** Custom columns — if not supplied, sensible defaults are used. */
  columns?: ColumnDef<AuditLogRow>[];
  /** Default page size. */
  pageSize?: number;
  /** Stable name for the export filename. */
  exportName?: string;
}

const DEFAULT_COLUMNS: ColumnDef<AuditLogRow>[] = [
  {
    accessorKey: "timestamp",
    header: "When",
    cell: (info) => (
      <span className="font-mono text-caption">
        {new Date(info.getValue<string>()).toISOString().replace("T", " ").slice(0, 19)}
      </span>
    ),
  },
  {
    accessorKey: "actor",
    header: "Actor",
    cell: (info) => <span className="font-mono text-caption">{info.getValue<string>()}</span>,
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: (info) => (
      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-caption">
        {info.getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "resource_type",
    header: "Resource",
    cell: (info) => (
      <span className="text-caption">
        {info.getValue<string>()}{" "}
        <span className="text-slate-500">
          {info.row.original.resource_id.slice(0, 12)}
        </span>
      </span>
    ),
  },
  {
    accessorKey: "workspace_id",
    header: "Workspace",
    cell: (info) => {
      const v = info.getValue<string | null>();
      return v ? <span className="font-mono text-caption">{v.slice(0, 10)}</span> : <span className="text-slate-400">—</span>;
    },
  },
  {
    accessorKey: "ticket_id",
    header: "Ticket",
    cell: (info) => {
      const v = info.getValue<string | null>();
      return v ? <span className="font-mono text-caption">{v}</span> : <span className="text-slate-400">—</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: (info) => {
      const v = info.getValue<AuditLogRow["status"]>();
      const cls =
        v === "succeeded"
          ? "bg-success-100 text-success-700"
          : v === "failed"
            ? "bg-error-100 text-error-700"
            : "bg-warning-100 text-warning-700";
      return (
        <span className={`rounded px-1.5 py-0.5 text-caption ${cls}`}>{v}</span>
      );
    },
  },
  {
    accessorKey: "reason",
    header: "Reason",
    cell: (info) => (
      <span className="text-caption text-slate-700" title={info.getValue<string>()}>
        {info.getValue<string>().length > 80
          ? info.getValue<string>().slice(0, 80) + "…"
          : info.getValue<string>()}
      </span>
    ),
  },
];

function rowsToCsv(rows: AuditLogRow[]): string {
  const headers = [
    "id",
    "timestamp",
    "actor",
    "action",
    "resource_type",
    "resource_id",
    "workspace_id",
    "ticket_id",
    "status",
    "reason",
  ];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => esc(r[h as keyof AuditLogRow])).join(","),
    ),
  ].join("\n");
}

export function AuditLogTable({
  rows,
  columns,
  pageSize = 25,
  exportName = "audit-log",
}: AuditLogTableProps) {
  const cols = useMemo(() => columns ?? DEFAULT_COLUMNS, [columns]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "timestamp", desc: true },
  ]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data: rows,
    columns: cols,
    state: { sorting, columnFilters: filters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function downloadCsv() {
    const filtered = table.getFilteredRowModel().rows.map((r) => r.original);
    const csv = rowsToCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter actor / action / reason..."
            className="w-72 rounded border border-slate-300 px-2 py-1 text-body-sm"
            onChange={(e) => {
              const v = e.target.value.trim().toLowerCase();
              table.setGlobalFilter(v);
            }}
          />
          <span className="text-caption text-slate-500">
            {table.getFilteredRowModel().rows.length} rows
          </span>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-body-sm hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="bg-slate-50 text-left">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="cursor-pointer select-none px-3 py-2 text-caption font-medium uppercase tracking-wide text-slate-500"
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{
                        asc: <ArrowUp className="h-3 w-3" />,
                        desc: <ArrowDown className="h-3 w-3" />,
                      }[h.column.getIsSorted() as string] ?? (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-t border-slate-100",
                  r.original.status === "failed" && "bg-error-50/40",
                )}
              >
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-3 py-1.5 align-top">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.length}
                  className="px-3 py-6 text-center text-body-sm text-slate-500"
                >
                  No rows.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-caption text-slate-600">
        <div className="flex items-center gap-2">
          <label>
            Rows
            <select
              value={pagination.pageSize}
              onChange={(e) =>
                setPagination((p) => ({ ...p, pageSize: Number(e.target.value), pageIndex: 0 }))
              }
              className="ml-1 rounded border border-slate-300 px-1 py-0.5"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded border border-slate-300 p-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border border-slate-300 p-1 disabled:opacity-40"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
