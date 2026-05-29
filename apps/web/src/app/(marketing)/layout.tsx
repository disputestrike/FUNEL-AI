import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

/**
 * Layout shared by all public marketing routes.
 * The dashboard has its own layout under (dashboard).
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
