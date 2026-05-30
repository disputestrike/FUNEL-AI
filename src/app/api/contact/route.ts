import { NextResponse } from "next/server";
import { z } from "zod";

const ContactRequest = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(160).optional().default(""),
  topic: z.enum(["sales", "support", "agency", "security", "press"]).default("sales"),
  message: z.string().trim().min(10).max(4000),
});

const ROUTING: Record<z.infer<typeof ContactRequest>["topic"], string> = {
  sales: "sales@gofunnelai.com",
  support: "support@gofunnelai.com",
  agency: "partners@gofunnelai.com",
  security: "security@gofunnelai.com",
  press: "press@gofunnelai.com",
};

type ContactRecord = z.infer<typeof ContactRequest> & {
  contact_id: string;
  received_at: string;
  routing: string;
};

const globalForContacts = globalThis as typeof globalThis & {
  __gofunnel_contacts?: ContactRecord[];
};

function contactStore() {
  globalForContacts.__gofunnel_contacts ??= [];
  return globalForContacts.__gofunnel_contacts;
}

export async function POST(req: Request) {
  const parsed = ContactRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid name, email, topic, and message are required." }, { status: 400 });
  }

  const contact: ContactRecord = {
    ...parsed.data,
    contact_id: `cnt_${Date.now().toString(36)}`,
    received_at: new Date().toISOString(),
    routing: ROUTING[parsed.data.topic],
  };
  contactStore().push(contact);

  return NextResponse.json({
    ok: true,
    contact_id: contact.contact_id,
    routing: contact.routing,
    received_at: contact.received_at,
  });
}

export async function GET() {
  const contacts = contactStore();
  return NextResponse.json({
    ok: true,
    count: contacts.length,
    latest: contacts.at(-1) ?? null,
  });
}
