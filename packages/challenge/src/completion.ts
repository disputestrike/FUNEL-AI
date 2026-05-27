/**
 * Completion certificate generator.
 *
 *   - Shareable PNG (1080×1080 + 1200×630 LinkedIn variant).
 *   - Contains: participant name, cohort number, completion date, brand mark.
 *   - Auto-emailed Day 8.
 *   - Pre-filled share posts.
 *   - URL carries `?utm_source=challenge_cert&cohort=<id>` for re-attribution.
 *
 * Actual image rendering lives in the workers app (`apps/workers`); this
 * module assembles the data + the public URL.
 */

import type { ChallengeStore } from "./store.js";
import type { Cohort, Participant } from "./types.js";

export interface CertificateRenderer {
  render(args: {
    participant_id: string;
    cohort_id: string;
    cohort_number: number;
    display_name: string;
    completion_date: string;
  }): Promise<{ png_1080_url: string; png_linkedin_url: string }>;
}

export interface CertificateDeps {
  store: ChallengeStore;
  renderer: CertificateRenderer;
  email: {
    send(args: { to: string; subject: string; template: string; data: Record<string, unknown> }): Promise<{ message_id: string }>;
  };
  clock?: { iso(): string };
  baseSiteUrl?: string;
  emit?: (
    name: "challenge_certificate_issued",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

/**
 * Issue a certificate for a participant who completed all 7 days. Idempotent —
 * if a certificate already exists we return it.
 */
export async function issueCertificate(
  args: { participant_id: string },
  deps: CertificateDeps,
): Promise<{ participant: Participant; png_1080_url: string; png_linkedin_url: string; share_url: string }> {
  const clock = deps.clock ?? defaultClock;
  const p = await deps.store.getParticipantById(args.participant_id);
  if (!p) throw new Error("participant not found");
  if (p.days_completed.length < 7) throw new Error("participant has not completed all 7 days");

  if (p.certificate_url) {
    return {
      participant: p,
      png_1080_url: p.certificate_url,
      png_linkedin_url: p.certificate_url.replace("1080", "linkedin"),
      share_url: shareUrlFor(p, deps.baseSiteUrl ?? "https://gofunnelai.com"),
    };
  }

  const cohort = await deps.store.getCohortById(p.cohort_id);
  if (!cohort) throw new Error("cohort not found");

  const display_name = p.email.split("@")[0] ?? "Builder";
  const completion_date = clock.iso().slice(0, 10);
  const rendered = await deps.renderer.render({
    participant_id: p.id,
    cohort_id: cohort.id,
    cohort_number: cohort.cohort_number,
    display_name,
    completion_date,
  });
  const next = await deps.store.updateParticipant(p.id, {
    certificate_url: rendered.png_1080_url,
  });

  const share_url = shareUrlFor(next, deps.baseSiteUrl ?? "https://gofunnelai.com");

  await deps.email.send({
    to: next.email,
    subject: `You finished the 7-Day Funnel Challenge. Here's your certificate.`,
    template: "challenge-certificate",
    data: {
      display_name,
      cohort_number: cohort.cohort_number,
      png_url: rendered.png_1080_url,
      png_linkedin_url: rendered.png_linkedin_url,
      share_url,
    },
  });

  if (deps.emit) {
    await deps.emit("challenge_certificate_issued", {
      user_id: next.user_id,
      cohort_id: next.cohort_id,
      certificate_url: rendered.png_1080_url,
    });
  }

  return {
    participant: next,
    png_1080_url: rendered.png_1080_url,
    png_linkedin_url: rendered.png_linkedin_url,
    share_url,
  };
}

function shareUrlFor(p: Participant, baseSiteUrl: string): string {
  return `${baseSiteUrl}/challenge/${p.cohort_id}/cert/${p.id}?utm_source=challenge_cert&cohort=${p.cohort_id}`;
}
