import { Suspense } from "react";
import { SignupCard } from "./SignupCard";

/**
 * /signup — Google-only sign-up. Same single-button UX as /login, but with
 * the activation copy ("Get your first customer in 60 seconds") and a
 * post-OAuth redirect to /welcome instead of /dashboard.
 */
export const metadata = {
  title: "Sign up | GoFunnelAI",
  description:
    "Get your first customer in 60 seconds. Free forever. No credit card. Sign up with Google.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupCard />
    </Suspense>
  );
}
