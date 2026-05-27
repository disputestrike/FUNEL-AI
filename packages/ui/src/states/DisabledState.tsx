import * as React from "react";
import { cn } from "../lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../primitives/tooltip";

/**
 * DisabledState — wraps any interactive element to render it visually distinct
 * AND attach a tooltip explaining WHY it's disabled. Doc 22 standard: a
 * disabled control without explanation is a dead end.
 */
export interface DisabledStateProps {
  children: React.ReactElement;
  /** The reason this is disabled. Required — that's the point. */
  reason: string;
  /** When true, renders as enabled (escape hatch). */
  enabled?: boolean;
  className?: string;
}

export function DisabledState({ children, reason, enabled, className }: DisabledStateProps): JSX.Element {
  if (enabled) return children;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("inline-block cursor-not-allowed", className)}
            aria-disabled="true"
            tabIndex={0}
            // Tooltip needs a focusable wrapper; the inner element is pointer-events-none.
          >
            {React.cloneElement(children, {
              disabled: true,
              "aria-disabled": true,
              className: cn(children.props.className, "pointer-events-none opacity-50"),
              tabIndex: -1,
            })}
          </span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
