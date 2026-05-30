import { OfferGeneratorClient } from "./OfferGeneratorClient";

export const metadata = {
  title: "Generate | gofunnelai.com",
};

export default function GeneratePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <OfferGeneratorClient />
      </div>
    </main>
  );
}
