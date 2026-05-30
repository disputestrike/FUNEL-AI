/**
 * Module augmentation for next-auth.
 *
 * `src/lib/auth.ts` hydrates the JWT in the `jwt` callback and mirrors
 * the fields onto the Session in the `session` callback. We augment both
 * the Session and JWT types here so every server component / route
 * handler reads them with full type safety.
 */
import "next-auth";
import "next-auth/jwt";

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

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    workspaceId?: string;
    workspaceSlug?: string;
    role?: "owner" | "admin" | "editor" | "viewer";
    plan?: "free" | "starter" | "growth" | "scale" | "agency";
  }
}
