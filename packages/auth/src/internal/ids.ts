/**
 * Prefixed IDs.
 *
 * Every domain object gets a stable typed prefix so a raw id like `ses_…`
 * is self-describing in logs and bug reports.
 */

import { nanoid } from "nanoid";

export type IdPrefix =
  | "usr"
  | "ses"
  | "tok"
  | "inv"
  | "key"
  | "imp"
  | "adm"
  | "mfa"
  | "wsm";

export function newId(prefix: IdPrefix, size = 21): string {
  return `${prefix}_${nanoid(size)}`;
}
