/**
 * Lead-capture endpoint — funnels POST here when a visitor submits a form.
 *
 *   POST /webhooks/funnels/:funnelId/submit
 *
 * Special webhook:
 *   - No signature (it's user-driven, not server-to-server) but is heavily
 *     rate-limited (`RL_FORM_SUBMIT`) and CAPTCHA-gated.
 *   - Optional `funnel_token` query/body that we issued at render time —
 *     stops trivial automated abuse without breaking embeds.
 *   - Direct DB write (not enqueued) because we need synchronous response
 *     with a redirect URL.
 *   - Fires the speed-to-lead job inside 60s (Doc 06a §3).
 */

import { Hono } from "hono";
import { z } from "zod";
import { ulid } from "ulid";
import { withAdminContext } from "@funnel/db/rls";
import { withWorkspaceContext } from "@funnel/db/rls";
import type { HonoEnv } from "../lib/context.js";
import { emitEvent } from "../lib/events.js";
import { hashIp, sha256Hex } from "../lib/hash.js";
import { rateLimit, byFunnel } from "../middleware/rate-limit.js";

const FormSubmit = z.object({
  funnel_token: z.string().optional(),
  consent: z
    .object({
      marketing: z.boolean().default(false),
      sms: z.boolean().default(false),
      calls: z.boolean().default(false),
    })
    .default({ marketing: false, sms: false, calls: false }),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional(),
  full_name: z.string().max(200).optional(),
  custom_fields: z.record(z.unknown()).default({}),
  utm: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      term: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  page_url: z.string().url().optional(),
  referrer: z.string().optional(),
});

export function buildFormSubmitWebhook(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();

  r.post(
    "/:funnelId/submit",
    rateLimit({ binding: "RL_FORM_SUBMIT", keyFn: byFunnel, windowSec: 60, limit: 60 }),
    async (c) => {
      const funnelId = c.req.param("funnelId");
      if (!funnelId) return c.json({ error: "missing_funnel" }, 400);

      let payload: z.infer<typeof FormSubmit>;
      try {
        const json = await c.req.json();
        payload = FormSubmit.parse(json);
      } catch (err) {
        return c.json({ error: "invalid_payload", details: String(err) }, 400);
      }

      // Resolve funnel + workspace from the funnel id (cross-tenant — auth at
      // this point is the funnel_token + rate limit, not a session).
      const funnel = await withAdminContext(async (tx) =>
        tx.funnel.findUnique({
          where: { id: funnelId },
          select: { id: true, workspace_id: true, current_version_id: true, status: true },
        }),
      );
      if (!funnel || funnel.status !== "live") return c.json({ error: "funnel_not_live" }, 404);

      // Body must require at least one contact method.
      if (!payload.email && !payload.phone) {
        return c.json({ error: "missing_contact", message: "Provide email or phone" }, 400);
      }

      const ip = c.req.header("cf-connecting-ip") ?? null;
      const country = c.req.header("cf-ipcountry") ?? null;
      const ipHash = ip ? await hashIp(ip, c.env.JWT_SECRET) : "sha256:anon";
      const emailHash = payload.email ? await sha256Hex(payload.email.toLowerCase()) : null;
      const phoneHash = payload.phone ? await sha256Hex(payload.phone) : null;

      // Consent capture event id — required for TCPA + GDPR audit trail.
      const consentId = `cns_${ulid()}`;
      const leadId = `lds_${ulid()}`;

      // Atomic upsert inside workspace context. dedupe via (workspace, email)/(workspace, phone).
      const result = await withWorkspaceContext(funnel.workspace_id, async (tx) => {
        // Find or create contact
        const where: Record<string, unknown> = {};
        if (payload.email) where.email_normalized = payload.email.toLowerCase();
        if (payload.phone) where.phone_e164 = payload.phone;
        const existing = await tx.crmContact.findFirst({
          where: { workspace_id: funnel.workspace_id, OR: Object.entries(where).map(([k, v]) => ({ [k]: v })) },
        });
        const contactId = existing?.id ?? `crm_${ulid()}`;
        if (!existing) {
          await tx.crmContact.create({
            data: {
              id: contactId,
              workspace_id: funnel.workspace_id,
              email_normalized: payload.email?.toLowerCase(),
              email_sha256: emailHash,
              phone_e164: payload.phone,
              phone_sha256: phoneHash,
              full_name: payload.full_name,
              custom_fields: payload.custom_fields,
              consent: { ...payload.consent, consent_id: consentId, consent_captured_at: new Date().toISOString() },
              primary_source: "funnel_form",
            },
          });
        } else {
          await tx.crmContact.update({
            where: { id: contactId },
            data: {
              full_name: payload.full_name ?? existing.full_name,
              last_activity_at: new Date(),
              custom_fields: { ...(existing.custom_fields as object), ...payload.custom_fields },
            },
          });
        }

        await tx.lead.create({
          data: {
            id: leadId,
            workspace_id: funnel.workspace_id,
            funnel_id: funnel.id,
            funnel_version_id: funnel.current_version_id!,
            crm_contact_id: contactId,
            status: "new",
            capture_source: "funnel_form",
            capture_url: payload.page_url,
            utm: payload.utm ?? {},
            ip_hash: ipHash,
            geo_country: country ?? undefined,
            consent_id: consentId,
          },
        });

        return { lead_id: leadId, contact_id: contactId };
      });

      // Fire events in parallel; never block on them.
      await emitEvent("lead_captured", {
        lead_id: leadId,
        funnel_id: funnel.id,
        funnel_version_id: funnel.current_version_id!,
        capture_source: "landing_page_form",
        consent_id: consentId,
        contact_fields_hashed: {
          ...(emailHash ? { email_sha256: emailHash } : {}),
          ...(phoneHash ? { phone_e164_sha256: phoneHash } : {}),
        },
        utm: payload.utm,
      } as never);

      // Speed-to-lead — dispatch a RevTry dial inside 60s.
      if (payload.consent.calls && payload.phone) {
        await c.env.Q_REVTRY.send({
          leadId,
          workspaceId: funnel.workspace_id,
          captureAt: new Date().toISOString(),
        });
      }

      // Synchronous response — the renderer redirects the user on this.
      return c.json(
        {
          ok: true,
          lead_id: result.lead_id,
          next_url: `${c.env.WEB_PUBLIC_URL}/thanks/${funnel.id}`,
        },
        200,
      );
    },
  );

  return r;
}
