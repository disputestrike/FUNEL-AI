import { describe, expect, it } from "vitest";

import { QUEUE_NAMES, QUEUE_REGISTRY, resolveConcurrency } from "../../src/queues.js";

describe("queue registry", () => {
  it("declares every required queue", () => {
    const required = [
      "generation",
      "ad-publishing",
      "email",
      "sms",
      "webhooks-outbound",
      "speed-to-lead",
      "dunning",
      "activation",
      "ingestion",
      "reconciliation",
      "bias-audit",
      "analytics",
      "ts-classifier",
      "backups-restore-drill",
      "domain-reputation",
      "model-version-promote",
      "recursive-learning",
      "card-expiring-alerts",
      "dlq",
    ] as const;
    for (const r of required) expect(QUEUE_NAMES).toContain(r);
  });

  it("matches the spec concurrencies", () => {
    expect(QUEUE_REGISTRY.generation.concurrency).toBe(20);
    expect(QUEUE_REGISTRY["ad-publishing"].concurrency).toBe(10);
    expect(QUEUE_REGISTRY.email.concurrency).toBe(50);
    expect(QUEUE_REGISTRY.sms.concurrency).toBe(30);
    expect(QUEUE_REGISTRY["webhooks-outbound"].concurrency).toBe(50);
    expect(QUEUE_REGISTRY["speed-to-lead"].concurrency).toBe(100);
    expect(QUEUE_REGISTRY.dunning.concurrency).toBe(10);
    expect(QUEUE_REGISTRY.activation.concurrency).toBe(20);
    expect(QUEUE_REGISTRY.ingestion.concurrency).toBe(5);
    expect(QUEUE_REGISTRY.reconciliation.concurrency).toBe(5);
    expect(QUEUE_REGISTRY["bias-audit"].concurrency).toBe(2);
    expect(QUEUE_REGISTRY.analytics.concurrency).toBe(20);
  });

  it("matches the spec retry counts", () => {
    expect(QUEUE_REGISTRY.generation.defaultJobOptions.attempts).toBe(3);
    expect(QUEUE_REGISTRY["ad-publishing"].defaultJobOptions.attempts).toBe(5);
    expect(QUEUE_REGISTRY["webhooks-outbound"].defaultJobOptions.attempts).toBe(5);
    expect(QUEUE_REGISTRY.dunning.defaultJobOptions.attempts).toBe(5);
    expect(QUEUE_REGISTRY["bias-audit"].defaultJobOptions.attempts).toBe(1);
  });

  it("generation + speed-to-lead share the highest priority", () => {
    expect(QUEUE_REGISTRY.generation.defaultJobOptions.priority).toBe(1);
    expect(QUEUE_REGISTRY["speed-to-lead"].defaultJobOptions.priority).toBe(1);
  });

  it("analytics is lower priority than transactional queues", () => {
    const analyticsPrio = QUEUE_REGISTRY.analytics.defaultJobOptions.priority ?? 100;
    const emailPrio = QUEUE_REGISTRY.email.defaultJobOptions.priority ?? 0;
    expect(analyticsPrio).toBeGreaterThan(emailPrio);
  });

  it("resolveConcurrency honours env override", () => {
    expect(resolveConcurrency("email", { email: 200 })).toBe(200);
    expect(resolveConcurrency("email", {})).toBe(50);
    expect(resolveConcurrency("email", { email: 0 })).toBe(50);
  });
});
