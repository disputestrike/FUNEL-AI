/**
 * Merged event schema registry — `eventName → ZodSchema`.
 */

import type { ZodSchema } from "zod";
import { Schemas as Identity } from "./events/identity.js";
import { Schemas as Generation } from "./events/generation.js";
import { Schemas as Publish } from "./events/publish.js";
import { Schemas as Distribution } from "./events/distribution.js";
import { Schemas as Lead } from "./events/lead.js";
import { Schemas as Revenue } from "./events/revenue.js";
import { Schemas as Subscription } from "./events/subscription.js";
import { Schemas as Support } from "./events/support.js";
import { Schemas as Governance } from "./events/governance.js";

export const EVENT_SCHEMAS: Record<string, ZodSchema<unknown>> = {
  ...Identity,
  ...Generation,
  ...Publish,
  ...Distribution,
  ...Lead,
  ...Revenue,
  ...Subscription,
  ...Support,
  ...Governance,
};

export function getSchema(name: string): ZodSchema<unknown> | null {
  return EVENT_SCHEMAS[name] ?? null;
}
