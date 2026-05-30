import type { ReactNode } from "react";
import { Header } from "@/components/site/Header";

/**
 * Dashboard root layout — guarantees the sticky header (with the signed-in
 * user menu + Sign out) renders on every /dashboard route.
 *
 * Individual pages used to render <Header /> themselves; centralising it
 * here means new pages get the chrome for free and the Sign out button is
 * always one click away.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
