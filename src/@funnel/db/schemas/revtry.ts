import { z } from "zod";
import {
  id,
  isoDateTime,
  isoDateTimeNullable,
  jsonObject,
  moneyMicros,
} from "./common.js";

export const CallOutcomeSchema = z.enum([
  "answered",
  "no_answer",
  "voicemail",
  "busy",
  "failed",
  "do_not_call",
]);

export const RevTryCallSchema = z.object({
  id: id("revtryCall"),
  workspaceId: id("workspace"),
  leadId: id("lead"),
  attemptN: z.number().int().min(1),
  agentVoiceId: z.string().min(1).max(120),
  scriptVersion: z.string().min(1).max(64),
  fromNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "expected E.164 phone for from_number"),
  toNumberHash: z.string().length(64),
  toNumberCountry: z.string().length(2).nullable().optional(),
  startedAt: isoDateTime,
  endedAt: isoDateTimeNullable,
  durationSec: z.number().int().nonnegative().nullable().optional(),
  outcome: CallOutcomeSchema.nullable().optional(),
  dispositionCode: z.string().max(64).nullable().optional(),
  recordingS3Uri: z
    .string()
    .startsWith("s3://")
    .max(2048)
    .nullable()
    .optional(),
  transcriptS3Uri: z
    .string()
    .startsWith("s3://")
    .max(2048)
    .nullable()
    .optional(),
  sentimentScore: z.number().min(-1).max(1).nullable().optional(),
  objections: z.array(z.string().max(120)).default([]),
  consentRecorded: z.boolean().default(false),
  costUsdMicros: moneyMicros.nullable().optional(),
  carrierMetadata: jsonObject.default({}),
  piiRedactedAt: isoDateTimeNullable,
  createdAt: isoDateTime,
});

export type RevTryCall = z.infer<typeof RevTryCallSchema>;
