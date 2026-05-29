import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { getDashboardSession } from "@/lib/data";

/**
 * Security — Google Sign-in inherits the account's password, 2FA factors,
 * and device session list. We deep-link to the Google security console.
 */
export const metadata = { title: "Security | Settings | GoFunnelAI" };
export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login?callbackUrl=/settings/security");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-success-600" />
          <div>
            <h2 className="text-h4 font-semibold text-slate-900">Security</h2>
            <p className="mt-1 text-body-sm text-slate-500">
              GoFunnelAI signs you in with Google. Your password, two-factor
              authentication, security keys, and active device sessions all
              live in your Google account.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="https://myaccount.google.com/security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-body-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Google account security
            <ExternalLink className="size-4 text-slate-400" />
          </Link>
          <Link
            href="https://myaccount.google.com/signinoptions/two-step-verification"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-body-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Manage 2-Step Verification
            <ExternalLink className="size-4 text-slate-400" />
          </Link>
          <Link
            href="https://myaccount.google.com/connections"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-body-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Apps connected to Google
            <ExternalLink className="size-4 text-slate-400" />
          </Link>
          <Link
            href="https://myaccount.google.com/device-activity"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-body-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Active devices
            <ExternalLink className="size-4 text-slate-400" />
          </Link>
        </div>

        <p className="mt-6 text-caption text-slate-500">
          Signed in as <span className="font-medium">{session.email}</span>.
        </p>
      </div>
    </div>
  );
}
