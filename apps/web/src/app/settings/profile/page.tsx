import Image from "next/image";
import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/data";
import { ProfileForm } from "./ProfileForm";

/**
 * Profile settings — name + avatar come from Google and are read-only here
 * (the user updates them at myaccount.google.com); timezone defaults from
 * the browser but is editable and persists to `users.timezone`.
 */
export const metadata = { title: "Profile | Settings | GoFunnelAI" };
export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login?callbackUrl=/settings/profile");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-h4 font-semibold text-slate-900">Your profile</h2>
        <p className="mt-1 text-body-sm text-slate-500">
          Name and avatar come from your Google account. Update them at{" "}
          <a
            href="https://myaccount.google.com/personal-info"
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal-600 underline hover:text-signal-700"
          >
            myaccount.google.com
          </a>{" "}
          and they sync here on next sign-in.
        </p>

        <div className="mt-6 flex items-center gap-4">
          {session.image ? (
            <Image
              src={session.image}
              alt={session.fullName ?? session.email}
              width={64}
              height={64}
              className="size-16 rounded-full border border-slate-200"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-signal-100 text-h4 font-semibold text-signal-700">
              {(session.fullName ?? session.email)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-body font-medium text-slate-900">
              {session.fullName ?? "Unnamed"}
            </div>
            <div className="text-caption text-slate-500">{session.email}</div>
          </div>
        </div>
      </div>

      <ProfileForm />
    </div>
  );
}
