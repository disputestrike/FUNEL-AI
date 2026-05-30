import { redirect } from "next/navigation";

/**
 * Legacy /sign-in catch-all → permanent redirect to the Auth.js /login page.
 * Preserves `redirect_url` (Clerk's name) and `callbackUrl` (Auth.js's name).
 */
export default function LegacySignInPage({
  searchParams,
}: {
  searchParams: { redirect_url?: string; callbackUrl?: string };
}) {
  const target =
    searchParams.callbackUrl ?? searchParams.redirect_url ?? "/dashboard";
  const url = new URL("/login", "https://gofunnelai.com");
  url.searchParams.set("callbackUrl", target);
  redirect(url.pathname + url.search);
}
