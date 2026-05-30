import { Suspense } from "react";
import { LoginCard } from "./LoginCard";

/**
 * /login — Google-only sign-in.
 *
 * Server component shell wrapping a client-side <LoginCard /> so we can keep
 * the `metadata` export AND read `useSearchParams()` for `callbackUrl`.
 */
export const metadata = {
  title: "Sign in | GoFunnelAI",
  description:
    "Sign in to your GoFunnelAI workspace with Google in one click.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  );
}
