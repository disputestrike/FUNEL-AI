import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind class names. Resolves conflicts (`px-4` + `px-6` -> `px-6`)
 * via tailwind-merge after clsx normalizes truthy/falsy/conditional values.
 *
 * Used by every primitive and every funnel block. The single utility is the
 * surface area for class composition in the entire library.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
