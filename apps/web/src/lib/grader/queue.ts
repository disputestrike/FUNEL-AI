/**
 * Cloudflare Queues dispatcher.
 *
 * In production the Next.js side forwards the audit job to the agent-runner
 * Worker over HTTP (the Worker handles the queue subscription). For local
 * dev we just POST directly to the runner.
 */

const RUNNER_URL = process.env.AGENT_RUNNER_URL ?? "https://grader-agents.gofunnelai.com";
const RUNNER_SECRET = process.env.AGENT_RUNNER_SECRET ?? "dev-secret";

export interface AuditJobPayload {
  audit_id: string;
  url: string;
}

/** Fire-and-forget enqueue. The runner will SSE back to the audit's pubsub channel. */
export async function dispatchAuditJob(job: AuditJobPayload): Promise<void> {
  const resp = await fetch(`${RUNNER_URL}/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_SECRET}`,
    },
    body: JSON.stringify(job),
    // The runner returns 202 within a few ms; we don't wait for full audit.
    keepalive: true,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[queue] dispatch failed", err);
    return null;
  });

  if (resp && !resp.ok) {
    // eslint-disable-next-line no-console
    console.error("[queue] dispatch non-ok", resp.status);
  }
}
