import * as React from "react";
import { cn } from "../lib/cn";
import { Skeleton } from "../primitives/skeleton";

/**
 * LoadingState — composed skeleton screens that mirror real content.
 * NEVER a spinner. NEVER an ambiguous "Loading…" string alone.
 *
 * Doc 22 PART H — "Skeleton screens, never spinners. This is a hard rule."
 *
 * Pick a variant that matches the destination layout. If none fits, compose
 * `<Skeleton />` primitives directly.
 */
export type LoadingVariant = "card" | "list" | "table" | "kpi" | "page" | "form" | "kanban";

export interface LoadingStateProps {
  variant?: LoadingVariant;
  /** Number of repeated skeleton items in list/table variants. */
  count?: number;
  className?: string;
}

export function LoadingState({ variant = "card", count = 3, className }: LoadingStateProps): JSX.Element {
  return (
    <div className={cn(className)} role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading content</span>
      {variant === "card" && <CardLoading count={count} />}
      {variant === "list" && <ListLoading count={count} />}
      {variant === "table" && <TableLoading rows={count} />}
      {variant === "kpi" && <KpiLoading count={count} />}
      {variant === "page" && <PageLoading />}
      {variant === "form" && <FormLoading rows={count} />}
      {variant === "kanban" && <KanbanLoading />}
    </div>
  );
}

function CardLoading({ count }: { count: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-card p-6 dark:border-slate-700">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-6 w-2/3" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}

function ListLoading({ count }: { count: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TableLoading({ rows }: { rows: number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-4 border-b border-slate-100 px-3 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-slate-100 px-3 py-3 last:border-b-0">
          {Array.from({ length: 4 }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function KpiLoading({ count }: { count: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-card p-5 dark:border-slate-700">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="mt-3 h-8 w-1/2" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function PageLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <KpiLoading count={4} />
      <TableLoading rows={6} />
    </div>
  );
}

function FormLoading({ rows }: { rows: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-11 w-36" />
    </div>
  );
}

function KanbanLoading() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, col) => (
        <div key={col} className="space-y-3">
          <Skeleton className="h-4 w-1/2" />
          {Array.from({ length: 3 }).map((_, card) => (
            <div key={card} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="mt-2 h-3 w-2/5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
