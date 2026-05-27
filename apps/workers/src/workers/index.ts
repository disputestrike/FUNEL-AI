/**
 * Worker barrel — re-exports every worker constructor and provides a single
 * `buildAllWorkers()` factory used by the entrypoint. We keep this barrel so
 * tests can import a single worker without booting the others.
 */

import type { Worker } from "bullmq";

import { activationWorker } from "./activation.js";
import { adPublishingWorker } from "./ad-publishing.js";
import { analyticsWorker } from "./analytics.js";
import { backupsRestoreDrillWorker } from "./backups-restore-drill.js";
import { biasAuditWorker } from "./bias-audit.js";
import { cardExpiringAlertsWorker } from "./card-expiring-alerts.js";
import { domainReputationWorker } from "./domain-reputation.js";
import { dunningWorker } from "./dunning.js";
import { emailWorker } from "./email.js";
import { generationWorker } from "./generation.js";
import { ingestionWorker } from "./ingestion.js";
import { modelVersionPromoteWorker } from "./model-version-promote.js";
import { reconciliationWorker } from "./reconciliation.js";
import { recursiveLearningWorker } from "./recursive-learning.js";
import { smsWorker } from "./sms.js";
import { speedToLeadWorker } from "./speed-to-lead.js";
import { tsClassifierWorker } from "./ts-classifier.js";
import { webhooksOutboundWorker } from "./webhooks-outbound.js";

export const ALL_WORKERS = {
  activation: activationWorker,
  adPublishing: adPublishingWorker,
  analytics: analyticsWorker,
  backupsRestoreDrill: backupsRestoreDrillWorker,
  biasAudit: biasAuditWorker,
  cardExpiringAlerts: cardExpiringAlertsWorker,
  domainReputation: domainReputationWorker,
  dunning: dunningWorker,
  email: emailWorker,
  generation: generationWorker,
  ingestion: ingestionWorker,
  modelVersionPromote: modelVersionPromoteWorker,
  reconciliation: reconciliationWorker,
  recursiveLearning: recursiveLearningWorker,
  sms: smsWorker,
  speedToLead: speedToLeadWorker,
  tsClassifier: tsClassifierWorker,
  webhooksOutbound: webhooksOutboundWorker,
} as const;

export function asWorkerList(): Worker[] {
  return Object.values(ALL_WORKERS) as unknown as Worker[];
}
