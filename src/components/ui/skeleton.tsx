import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Skeleton — used in place of spinners per doc 22 §H.
 * Mirrors the layout of the content it replaces.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}
