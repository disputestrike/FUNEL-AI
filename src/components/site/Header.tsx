import Link from "next/link";
import { auth } from "@/lib/auth";
import { Lockup } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { HeaderNav } from "./HeaderNav";
import { UserMenu } from "./UserMenu";

/**
 * Server-component header. Reads the session via `auth()` so we can branch
 * on signed-in vs signed-out without shipping the user payload to the
 * client.
 *
 * Signed in →  avatar dropdown (Dashboard / Settings / Sign out).
 * Signed out → "Sign in" link + "Get started free" gradient CTA.
 *
 * Interactive bits (dropdown, mobile menu) live in <HeaderNav /> and
 * <UserMenu /> client islands so the shell itself stays static.
 */
export async function Header() {
  const session = await auth();
  const sessionUser = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }
    : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-slate-50/80 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/80">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="GoFunnelAI home"
        >
          <Lockup height={30} />
        </Link>

        <HeaderNav />

        <div className="hidden lg:flex items-center gap-2">
          <Link
            href="/grade"
            className="mr-1 inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-body-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Grade your funnel
          </Link>
          {sessionUser ? (
            <UserMenu user={sessionUser} />
          ) : (
            <>
              <Button variant="tertiary" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button variant="primary" size="sm" asChild>
                <Link href="/signup">Get started — free</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          {sessionUser ? (
            <UserMenu user={sessionUser} compact />
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-md px-1.5 text-body-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center rounded-md bg-[linear-gradient(135deg,#6817d2_0%,#d91a8f_48%,#ff7a00_100%)] px-2 text-body-sm font-semibold text-white shadow-sm hover:brightness-110"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
