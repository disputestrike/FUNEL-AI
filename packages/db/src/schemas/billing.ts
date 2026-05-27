import { z } from "zod";
import {
  currencyCode,
  id,
  isoDateTime,
  isoDateTimeNullable,
  jsonArray,
  jsonObject,
  moneyMicros,
} from "./common.js";

export const SubscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "suspended",
]);

export const InvoiceStatusSchema = z.enum([
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const PaymentStatusSchema = z.enum([
  "succeeded",
  "failed",
  "pending",
  "refunded",
  "partially_refunded",
]);

export const SubscriptionSchema = z.object({
  id: id("subscription"),
  workspaceId: id("workspace"),
  plan: z.string().min(1).max(64),
  status: SubscriptionStatusSchema.default("trialing"),
  externalProcessor: z.string().min(1).max(32).default("stripe"),
  externalSubscriptionId: z.string().max(200).nullable().optional(),
  externalCustomerId: z.string().max(200).nullable().optional(),
  currentPeriodStart: isoDateTimeNullable,
  currentPeriodEnd: isoDateTimeNullable,
  trialEndsAt: isoDateTimeNullable,
  canceledAt: isoDateTimeNullable,
  cancelAtPeriodEnd: z.boolean().default(false),
  cancellationReason: z.string().max(200).nullable().optional(),
  pausedAt: isoDateTimeNullable,
  resumeAt: isoDateTimeNullable,
  unitAmountMicros: moneyMicros.nullable().optional(),
  currency: currencyCode.default("USD"),
  quantity: z.number().int().min(1).default(1),
  metadata: jsonObject.default({}),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const InvoiceSchema = z.object({
  id: id("invoice"),
  workspaceId: id("workspace"),
  subscriptionId: id("subscription").nullable().optional(),
  externalProcessor: z.string().min(1).max(32).default("stripe"),
  externalInvoiceId: z.string().max(200).nullable().optional(),
  status: InvoiceStatusSchema.default("draft"),
  number: z.string().max(64).nullable().optional(),
  amountDueMicros: moneyMicros,
  amountPaidMicros: moneyMicros.default(0n as unknown as bigint),
  amountRefundedMicros: moneyMicros.default(0n as unknown as bigint),
  taxMicros: moneyMicros.default(0n as unknown as bigint),
  currency: currencyCode,
  periodStart: isoDateTimeNullable,
  periodEnd: isoDateTimeNullable,
  dueAt: isoDateTimeNullable,
  paidAt: isoDateTimeNullable,
  voidedAt: isoDateTimeNullable,
  hostedUrl: z.string().url().max(2048).nullable().optional(),
  pdfUrl: z.string().url().max(2048).nullable().optional(),
  lineItems: jsonArray.default([]),
  metadata: jsonObject.default({}),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const PaymentSchema = z.object({
  id: id("payment"),
  workspaceId: id("workspace"),
  invoiceId: id("invoice").nullable().optional(),
  externalProcessor: z.string().min(1).max(32).default("stripe"),
  externalPaymentId: z.string().max(200).nullable().optional(),
  amountMicros: moneyMicros,
  currency: currencyCode,
  status: PaymentStatusSchema,
  paymentMethodType: z.string().max(64).nullable().optional(),
  failureCode: z.string().max(64).nullable().optional(),
  failureText: z.string().max(500).nullable().optional(),
  attemptN: z.number().int().min(1).default(1),
  paidAt: isoDateTimeNullable,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const RefundSchema = z.object({
  id: id("refund"),
  workspaceId: id("workspace"),
  paymentId: id("payment").nullable().optional(),
  externalProcessor: z.string().min(1).max(32).default("stripe"),
  externalRefundId: z.string().max(200).nullable().optional(),
  amountMicros: moneyMicros,
  currency: currencyCode,
  reasonCode: z.string().max(64).nullable().optional(),
  initiatedByUserId: id("user").nullable().optional(),
  justification: z.string().max(500).nullable().optional(),
  refundedAt: isoDateTimeNullable,
  createdAt: isoDateTime,
});

export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type Refund = z.infer<typeof RefundSchema>;
