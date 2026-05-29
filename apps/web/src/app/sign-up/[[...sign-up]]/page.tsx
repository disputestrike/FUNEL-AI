import { redirect } from "next/navigation";

/**
 * Legacy /sign-up catch-all → permanent redirect to the Auth.js /signup page.
 */
export default function LegacySignUpPage({
  searchParams,
}: {
  searchParams: { redirect_url?: string; callbackUrl?: string };
}) {
  const target =
    searchParams.callbackUrl ?? searchParams.redirect_url ?? "/welcome";
  const url = new URL("/signup", "https://gofunnelai.com");
  url.searchParams.set("callbackUrl", target);
  redirect(url.pathname + url.search);
}
