import * as React from "react";
import { Lock } from "lucide-react";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { BlockShell } from "../primitives";
import type { BlockBaseProps, FormId, ResolvedForm } from "../types";
import { AB } from "../types";

/**
 * form.payment — Card capture + summary line items.
 * Doc 18 B.2.8.
 *
 * SECURITY: This component renders the UI; the actual card capture happens via
 * a host-supplied PCI-compliant element (Stripe Elements, etc.) injected as
 * the `paymentElement` slot. Never collect card numbers in plain inputs.
 */
export interface FormPaymentLineItem {
  label: string;
  amount_cents: number;
  description?: string;
}

export interface FormPaymentContent {
  form_id: FormId;
  headline?: string;
  line_items: FormPaymentLineItem[];
  currency: string;
  total_cents: number;
  trust_microcopy?: string;
  guarantee_copy?: string;
}

export type FormPaymentVariant = "stacked" | "two-column";

export interface FormPaymentProps extends BlockBaseProps {
  content: FormPaymentContent;
  variant?: FormPaymentVariant;
  /** Host-provided PCI-compliant element (Stripe/Adyen/Braintree). */
  paymentElement?: React.ReactNode;
  onSubmit?: (form: ResolvedForm | undefined, contact: { email: string; name?: string }) => void;
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function FormPayment({ content, variant = "two-column", sectionId, resolveForm, styleOverrides, paymentElement, onSubmit }: FormPaymentProps): JSX.Element {
  const form = resolveForm?.(content.form_id);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit?.(form, { email, name });
  };

  return (
    <BlockShell sectionId={sectionId} sectionType="form.payment" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className={variant === "two-column" ? "mx-auto grid max-w-marketing grid-cols-1 gap-8 md:grid-cols-2" : "mx-auto max-w-2xl"}>
        <div className="rounded-xl border border-slate-200 bg-card p-6 md:p-8">
          {content.headline && (
            <h2 className="font-display text-h3 font-semibold text-slate-900" {...AB("payment-headline")}>
              {content.headline}
            </h2>
          )}
          <form onSubmit={handle} noValidate className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${sectionId}-email`} required>
                Email
              </Label>
              <Input id={`${sectionId}-email`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${sectionId}-name`}>Name on card</Label>
              <Input id={`${sectionId}-name`} type="text" autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Card details</Label>
              <div className="rounded-md border border-slate-200 p-3">
                {paymentElement ?? (
                  <p className="text-body-sm text-slate-500">Card element will appear here when the payment provider is initialized.</p>
                )}
              </div>
            </div>
            <Button type="submit" variant="primary" size="lg" fullWidth {...AB("payment-cta")}>
              Pay {formatMoney(content.total_cents, content.currency)}
            </Button>
            {content.trust_microcopy && (
              <p className="flex items-center gap-1.5 text-caption text-slate-500">
                <Lock className="h-3.5 w-3.5" /> {content.trust_microcopy}
              </p>
            )}
          </form>
        </div>
        <aside className="rounded-xl border border-slate-200 bg-card p-6 md:p-8">
          <h3 className="text-h5 font-semibold text-slate-900">Order summary</h3>
          <ul className="mt-4 divide-y divide-slate-100">
            {content.line_items.map((item, i) => (
              <li key={i} className="flex items-start justify-between py-3 text-body-sm">
                <div>
                  <p className="font-medium text-slate-900">{item.label}</p>
                  {item.description && <p className="text-caption text-slate-500">{item.description}</p>}
                </div>
                <p className="tnum font-medium text-slate-900">{formatMoney(item.amount_cents, content.currency)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-body font-semibold tnum">
            <span>Total</span>
            <span>{formatMoney(content.total_cents, content.currency)}</span>
          </div>
          {content.guarantee_copy && <p className="mt-4 text-caption text-slate-500">{content.guarantee_copy}</p>}
        </aside>
      </div>
    </BlockShell>
  );
}
