/**
 * Module augmentation for next-auth. The `session` callback in
 * `apps/web/src/lib/auth.ts` injects `workspaceId`, `workspaceSlug`,
 * `role`, and `plan` onto the Session object. We declare those here so
 * every server component / route handler can read them with full type
 * safety.
 */
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
    workspaceId?: string;
    workspaceSlug?: string;
    role?: "owner" | "admin" | "editor" | "viewer";
    plan?: "free" | "starter" | "growth" | "scale" | "agency";
  }
}
