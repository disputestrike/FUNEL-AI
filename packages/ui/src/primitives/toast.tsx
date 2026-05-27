import * as React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

/**
 * Toast — sonner-based.
 *
 * Doc 22 PART H — Toasts:
 *   - Top-right, 360px max width, 4s auto-dismiss for success/info, 7s warning,
 *     errors require manual dismiss.
 *   - Border-left 4px in semantic color, paired icon, screen-reader announced.
 *
 * Toast is the one place exclamation marks are tolerated (doc 22 PART A — "no
 * exclamation marks in product copy — except success toasts").
 */
export type ToastProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToastProps): JSX.Element {
  return (
    <SonnerToaster
      position="top-right"
      richColors={false}
      closeButton
      gap={12}
      offset="16px"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-slate-200 group-[.toaster]:border-l-4 group-[.toaster]:rounded-md group-[.toaster]:shadow-lg group-[.toaster]:p-4",
          title: "text-body-sm font-semibold",
          description: "text-body-sm text-slate-600",
          actionButton: "group-[.toast]:bg-signal-500 group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-700",
          success: "group-[.toaster]:border-l-success-500",
          error: "group-[.toaster]:border-l-error-500",
          warning: "group-[.toaster]:border-l-warning-500",
          info: "group-[.toaster]:border-l-info-500",
        },
        duration: 4000,
      }}
      {...props}
    />
  );
}

/** Use `toast.success`, `toast.error`, `toast.warning`, `toast.info`. */
export const toast = sonnerToast;
