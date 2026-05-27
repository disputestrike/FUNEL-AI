/**
 * Stripe Tax integration.
 *
 * - Automatic VAT calculation per country (Stripe Tax handles 50+ jurisdictions).
 * - VAT-ID validation via Stripe Tax IDs (VIES under the hood for EU).
 * - Reverse-charge marking for EU B2B (Stripe sets `reverse_charge` on the
 *   invoice automatically when the customer's `tax_ids` contains a valid
 *   `eu_vat` and they are not in the merchant's home country).
 *
 * Doc 12 PRD 4 §11: tax compliance (US sales tax via TaxJar, VAT for EU launch).
 */

import type Stripe from "stripe";

import { BillingError } from "../types.js";
import { getStripeClient } from "./client.js";

/** EU country ISO-2 codes used for reverse-charge eligibility checks. */
export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

/** Country codes that get reverse-charge B2B exemption per EU VAT rules. */
export function isReverseChargeEligible(args: {
  customer_country: string;
  merchant_country: string;
  customer_vat_id?: string | null;
}): boolean {
  if (!args.customer_vat_id) return false;
  if (!EU_COUNTRIES.has(args.customer_country.toUpperCase())) return false;
  if (!EU_COUNTRIES.has(args.merchant_country.toUpperCase())) return false;
  return args.customer_country.toUpperCase() !== args.merchant_country.toUpperCase();
}

/** Add a VAT-ID to a Stripe customer; Stripe validates it via VIES. */
export async function addCustomerVatId(args: {
  customer_id: string;
  type: Stripe.TaxIdCreateParams.Type; // "eu_vat", "gb_vat", "br_cnpj", etc.
  value: string;
}): Promise<Stripe.TaxId> {
  const stripe = getStripeClient();
  return stripe.customers.createTaxId(args.customer_id, {
    type: args.type,
    value: args.value,
  });
}

/** Look up VAT-ID verification status for a customer's tax ids. */
export async function getCustomerTaxIds(customer_id: string): Promise<Stripe.TaxId[]> {
  const stripe = getStripeClient();
  const res = await stripe.customers.listTaxIds(customer_id, { limit: 25 });
  return res.data;
}

/** True if at least one TaxId is verified (Stripe's VIES result is "verified"). */
export async function isVatIdVerified(customer_id: string): Promise<boolean> {
  const ids = await getCustomerTaxIds(customer_id);
  return ids.some((t) => t.verification?.status === "verified");
}

/** Preview tax for a hypothetical invoice line — Stripe Tax `calculate` API. */
export async function calculateTax(args: {
  customer_id: string;
  amount_cents: number;
  currency: string;
  customer_country: string;
  customer_postal_code?: string;
}): Promise<{ tax_cents: number; effective_rate: number; jurisdiction: string }> {
  const stripe = getStripeClient();
  const calc = await stripe.tax.calculations.create({
    currency: args.currency.toLowerCase(),
    customer_details: {
      address: { country: args.customer_country, postal_code: args.customer_postal_code },
      address_source: "billing",
    },
    line_items: [
      {
        amount: args.amount_cents,
        reference: "billing.line",
        tax_behavior: "exclusive",
      },
    ],
  });
  const tax_cents = calc.tax_amount_exclusive ?? 0;
  const total_taxable = calc.amount_total - tax_cents || 1;
  return {
    tax_cents,
    effective_rate: tax_cents / total_taxable,
    jurisdiction: calc.line_items?.data?.[0]?.tax_breakdown?.[0]?.jurisdiction?.display_name ?? args.customer_country,
  };
}

/** Roll back tax when a refund is issued — Stripe Tax has a Transactions API. */
export async function rollbackTaxForRefund(args: {
  original_tax_transaction_id: string;
  refund_amount_cents: number;
  refund_id: string;
}): Promise<void> {
  const stripe = getStripeClient();
  try {
    await stripe.tax.transactions.createReversal({
      original_transaction: args.original_tax_transaction_id,
      reference: args.refund_id,
      mode: "partial",
      line_items: [
        {
          original_line_item: args.original_tax_transaction_id,
          amount: -args.refund_amount_cents,
          quantity: 1,
          reference: `refund:${args.refund_id}`,
        },
      ],
    });
  } catch (err) {
    throw new BillingError(
      `Tax rollback failed: ${err instanceof Error ? err.message : "unknown"}`,
      "stripe.tax_rollback_failed",
      502,
    );
  }
}
