/**
 * Path-shaped re-export for the per-call TwiML endpoint.
 *
 * The real Hono router lives at `apps/api/src/voice/twiml.ts` and binds
 * `/voice/:callId/twiml`. This file exists so callers can write
 * `import twimlRouter from "../voice/[callId]/twiml"` — matching the
 * Next.js-style dynamic-route notation used elsewhere in the codebase.
 */

export { buildVoiceTwiml as default, buildVoiceTwiml } from "../twiml.js";
