/**
 * Auth.js catch-all route handler. Exposes:
 *   - GET  /api/auth/signin
 *   - GET  /api/auth/callback/google
 *   - POST /api/auth/signout
 *   - GET  /api/auth/session
 *   - GET  /api/auth/csrf
 *   - GET  /api/auth/providers
 *
 * Delegates everything to the `handlers` exported from `@/lib/auth`.
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
