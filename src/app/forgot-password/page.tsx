import { redirect } from "next/navigation";

/**
 * Forgot-password is handled by Clerk's hosted flow. Redirect to the
 * standard sign-in entry point with the "forgot" intent — Clerk surfaces
 * the reset form from there.
 */
export default function ForgotPasswordPage() {
  redirect("/sign-in?forgot=1");
}
