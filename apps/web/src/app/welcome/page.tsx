import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WelcomeClient } from "./WelcomeClient";

/**
 * /welcome — landing for fresh sign-ups. Server component pulls the session
 * for the H1 personalization, then renders four onboarding-mode tiles that
 * funnel the user into `/onboarding/[mode]`.
 *
 * Confetti is fired by the <WelcomeClient /> island once on mount.
 */
export const metadata = { title: "Welcome | GoFunnelAI" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/welcome");

  const firstName =
    session.user.name?.split(" ")[0] ??
    session.user.email?.split("@")[0] ??
    "there";

  return <WelcomeClient firstName={firstName} />;
}
