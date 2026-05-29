/**
 * API versioning middleware.
 *
 * Resolves the effective API version from (in order of precedence):
 *   1. URL path segment (/v1, /v2)
 *   2. `Funnel-Version` header (date-string, e.g. 2026-01-15)
 *   3. The API key's pinned default version
 *
 * Echoes `Funnel-Version` on every response so SDKs can warn on drift.
 * v1 is frozen — additions only — and v2 is wired through the same Hono
 * router under a separate mount point.
 */

import type { MiddlewareHandler } from "hono";
import type { HonoEnv } from "../../lib/context.js";

export const SUPPORTED_VERSIONS = ["v1"] as const;
export const CURRENT_VERSION = "v1";
export const DEPRECATED_VERSIONS: string[] = [];

export type ApiVersion = (typeof SUPPORTED_VERSIONS)[number];

export const versioning = (mountedVersion: ApiVersion): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    c.set("apiVersion", mountedVersion);
    c.header("Funnel-Version", mountedVersion);

    if (DEPRECATED_VERSIONS.includes(mountedVersion)) {
      c.header(
        "Deprecation",
        `version="${mountedVersion}"; sunset="2027-01-01"; link="https://developers.gofunnelai.com/changelog"`,
      );
    }

    await next();
  };
};
