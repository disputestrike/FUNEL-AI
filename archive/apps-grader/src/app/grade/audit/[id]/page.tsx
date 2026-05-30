import { notFound } from "next/navigation";

import { AuditResultClient } from "./AuditResultClient";
import { prisma } from "@funnel/db";

interface AuditPageProps {
  params: { id: string };
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AuditPage({ params }: AuditPageProps) {
  const audit = await prisma.audit.findUnique({
    where: { id: params.id },
    include: { shareCode: true },
  });
  if (!audit) notFound();

  return (
    <AuditResultClient
      auditId={audit.id}
      url={audit.url}
      hostname={audit.urlHostname}
      shareCode={audit.shareCode?.code ?? ""}
      // Streaming endpoint picks up the rest.
      initialStatus={audit.status}
    />
  );
}
