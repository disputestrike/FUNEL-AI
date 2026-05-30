/** B.2 Form blocks — 8 components. */

import * as React from "react";
import { type BlockContext, Form, Section } from "./primitives.js";

type Props<T> = { id: string; content: T; ctx: BlockContext; variant?: string };

// B.2.1 — form.inline-single-field
export interface FormInlineSingleFieldContent {
  form_id: string;
  headline?: string;
  microcopy?: string;
  cta_label_override?: string;
}
export function FormInlineSingleField(p: Props<FormInlineSingleFieldContent>): React.ReactElement {
  return (
    <Section id={p.id} type="form.inline-single-field" className="bg-[var(--color-neutral-100)] py-12">
      <div className="mx-auto max-w-2xl px-6 text-center">
        {p.content.headline && <h2 className="font-display text-2xl font-bold md:text-3xl">{p.content.headline}</h2>}
        <div className="mt-6">
          <Form formId={p.content.form_id} ctx={p.ctx} submitLabel={p.content.cta_label_override ?? "Subscribe"} />
        </div>
        {p.content.microcopy && <p className="mt-3 text-xs text-[var(--color-neutral-600)]">{p.content.microcopy}</p>}
      </div>
    </Section>
  );
}

// B.2.2 — form.classic-3-field
export interface FormClassic3FieldContent {
  form_id: string;
  headline?: string;
  subhead?: string;
  consent_copy_override?: string;
  show_phone_optional?: boolean;
}
export function FormClassic3Field(p: Props<FormClassic3FieldContent>): React.ReactElement {
  return (
    <Section id={p.id} type="form.classic-3-field" className="bg-[var(--color-primary-50)] py-16">
      <div className="mx-auto max-w-md rounded-[var(--radius-xl)] bg-white p-8 shadow-[var(--shadow-lg)]">
        {p.content.headline && <h2 className="font-display text-2xl font-bold">{p.content.headline}</h2>}
        {p.content.subhead && <p className="mt-2 text-sm text-[var(--color-neutral-700)]">{p.content.subhead}</p>}
        <div className="mt-6">
          <Form formId={p.content.form_id} ctx={p.ctx} submitLabel="Get Started" />
        </div>
      </div>
    </Section>
  );
}

// B.2.3 — form.long-7-field
export interface FormLong7FieldContent {
  form_id: string;
  headline?: string;
  subhead?: string;
  progress_indicator?: boolean;
  trust_microcopy?: string;
}
export function FormLong7Field(p: Props<FormLong7FieldContent>): React.ReactElement {
  return (
    <Section id={p.id} type="form.long-7-field" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-2xl px-6">
        {p.content.headline && <h2 className="font-display text-3xl font-bold">{p.content.headline}</h2>}
        {p.content.subhead && <p className="mt-2 text-[var(--color-neutral-700)]">{p.content.subhead}</p>}
        <div className="mt-8 rounded-[var(--radius-xl)] bg-white p-6 md:p-8 shadow-[var(--shadow-md)]">
          <Form formId={p.content.form_id} ctx={p.ctx} submitLabel="Submit application" />
        </div>
        {p.content.trust_microcopy && <p className="mt-4 text-center text-xs text-[var(--color-neutral-600)]">{p.content.trust_microcopy}</p>}
      </div>
    </Section>
  );
}

// B.2.4 — form.multi-step (single-page SSR — JS hydrates step nav client-side)
export interface FormMultiStepContent {
  form_id: string;
  step_titles: string[];
  step_field_groups?: string[][];
  progress_style?: "bar" | "dots" | "numbered_steps";
  allow_back_navigation?: boolean;
  per_step_cta_label?: string[];
}
export function FormMultiStep(p: Props<FormMultiStepContent>): React.ReactElement {
  return (
    <Section id={p.id} type="form.multi-step" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-2xl px-6">
        <div
          data-funnel-multistep="1"
          data-allow-back={p.content.allow_back_navigation ? "1" : "0"}
          data-step-titles={JSON.stringify(p.content.step_titles)}
          data-step-groups={JSON.stringify(p.content.step_field_groups ?? [])}
          data-progress-style={p.content.progress_style ?? "bar"}
          data-step-ctas={JSON.stringify(p.content.per_step_cta_label ?? [])}
        >
          <div className="rounded-[var(--radius-xl)] bg-white p-6 md:p-8 shadow-[var(--shadow-md)]">
            <h2 className="font-display text-2xl font-bold">{p.content.step_titles[0]}</h2>
            <div className="mt-6">
              <Form formId={p.content.form_id} ctx={p.ctx} submitLabel={(p.content.per_step_cta_label ?? [])[0] ?? "Next"} />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// B.2.5 — form.calculator
export interface FormCalculatorContent {
  form_id: string;
  headline?: string;
  inputs: Array<{ field_id: string; min: number; max: number; step: number; unit?: string }>;
  estimate_formula: {
    expression: string;
    rounding?: "none" | "nearest_10" | "nearest_100" | "nearest_1000";
    currency_symbol?: string;
    disclaimer: string;
  };
  reveal_strategy?: "always_visible" | "after_email";
}
export function FormCalculator(p: Props<FormCalculatorContent>): React.ReactElement {
  return (
    <Section id={p.id} type="form.calculator" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-2xl px-6">
        {p.content.headline && <h2 className="font-display text-3xl font-bold text-center">{p.content.headline}</h2>}
        <div
          className="mt-8 rounded-[var(--radius-xl)] bg-white p-6 md:p-8 shadow-[var(--shadow-md)]"
          data-funnel-calculator="1"
          data-formula={p.content.estimate_formula.expression}
          data-currency={p.content.estimate_formula.currency_symbol ?? ""}
          data-rounding={p.content.estimate_formula.rounding ?? "none"}
          data-reveal={p.content.reveal_strategy ?? "always_visible"}
        >
          <div className="text-center">
            <div className="text-sm uppercase tracking-wider text-[var(--color-neutral-600)]">Your estimated savings</div>
            <div className="mt-2 text-4xl font-bold tabular-nums" data-funnel-calculator-output>—</div>
          </div>
          <div className="mt-6">
            <Form formId={p.content.form_id} ctx={p.ctx} submitLabel="Get My Quote" />
          </div>
          <p className="mt-4 text-xs text-[var(--color-neutral-600)]">{p.content.estimate_formula.disclaimer}</p>
        </div>
      </div>
    </Section>
  );
}

// B.2.6 — form.quiz
export interface FormQuizContent {
  form_id: string;
  questions: Array<{
    id: string;
    prompt: string;
    answer_type: "single_select" | "multi_select" | "slider" | "yes_no";
    options?: Array<{ value: string; label: string }>;
    branching_rules?: Array<{ if_answer: string; goto_question_id: string }>;
  }>;
  result_strategy?: "scored_segment" | "personalized_offer" | "lead_capture_only";
  result_screen_section_id?: string;
}
export function FormQuiz(p: Props<FormQuizContent>): React.ReactElement {
  return (
    <Section id={p.id} type="form.quiz" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-2xl px-6">
        <div
          data-funnel-quiz="1"
          data-questions={JSON.stringify(p.content.questions)}
          data-result-strategy={p.content.result_strategy ?? "lead_capture_only"}
          className="rounded-[var(--radius-xl)] bg-white p-8 shadow-[var(--shadow-md)]"
        >
          <div aria-live="polite">
            <h2 className="font-display text-2xl font-bold">{p.content.questions[0]?.prompt}</h2>
            <div className="mt-6 space-y-3">
              {(p.content.questions[0]?.options ?? []).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  data-quiz-answer={o.value}
                  data-quiz-question={p.content.questions[0]?.id}
                  className="block w-full rounded-[var(--radius-md)] border border-[var(--color-neutral-300)] bg-white px-4 py-3 text-left hover:border-[var(--color-primary-500)]"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div hidden data-quiz-final-form>
            <Form formId={p.content.form_id} ctx={p.ctx} submitLabel="See My Result" />
          </div>
        </div>
      </div>
    </Section>
  );
}

// B.2.7 — form.consultation-booking
export interface FormConsultationBookingContent {
  form_id: string;
  calendar_provider: "calendly" | "cal_com" | "google" | "native";
  calendar_url_or_id: string;
  headline?: string;
  subhead?: string;
}
export function FormConsultationBooking(p: Props<FormConsultationBookingContent>): React.ReactElement {
  return (
    <Section id={p.id} type="form.consultation-booking" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-3xl px-6">
        {p.content.headline && <h2 className="font-display text-3xl font-bold text-center">{p.content.headline}</h2>}
        {p.content.subhead && <p className="mt-2 text-center text-[var(--color-neutral-700)]">{p.content.subhead}</p>}
        <div className="mt-8 rounded-[var(--radius-xl)] bg-white p-6 md:p-8 shadow-[var(--shadow-md)]">
          <Form formId={p.content.form_id} ctx={p.ctx} submitLabel="See Available Times" />
          <div
            data-funnel-calendar="1"
            data-provider={p.content.calendar_provider}
            data-cal-id={p.content.calendar_url_or_id}
            className="mt-6"
            hidden
          >
            <iframe
              src={p.content.calendar_url_or_id}
              title="Booking calendar"
              loading="lazy"
              aria-label="Booking calendar"
              className="w-full h-[640px] border-0"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

// B.2.8 — form.payment (Stripe Elements — client-side init via attribute)
export interface FormPaymentContent {
  offer_id: string;
  processor: "stripe" | "paypal" | "stripe_with_apple_pay_google_pay";
  collect_billing_address?: boolean;
  collect_shipping_address?: boolean;
  enable_order_bumps?: Array<{ offer_id: string; default_checked: boolean }>;
  enable_one_click_upsell_after?: boolean;
  trust_badges_asset_ids?: string[];
  guarantee_copy?: string;
}
export function FormPayment(p: Props<FormPaymentContent>): React.ReactElement {
  return (
    <Section id={p.id} type="form.payment" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-md px-6">
        <div
          data-funnel-checkout="1"
          data-processor={p.content.processor}
          data-offer-id={p.content.offer_id}
          data-collect-billing={p.content.collect_billing_address ? "1" : "0"}
          data-collect-shipping={p.content.collect_shipping_address ? "1" : "0"}
          className="rounded-[var(--radius-xl)] bg-white p-6 md:p-8 shadow-[var(--shadow-lg)]"
        >
          <div className="space-y-4">
            <div className="text-sm font-medium">Payment details</div>
            <div id={`stripe-card-${p.id}`} className="rounded-[var(--radius-md)] border border-[var(--color-neutral-300)] p-3" />
            <button
              type="button"
              className="w-full rounded-[var(--radius-md)] bg-[var(--color-primary-500)] py-3 text-white font-semibold"
              data-funnel-checkout-submit
            >
              Complete purchase
            </button>
            {p.content.guarantee_copy && <p className="text-xs text-[var(--color-neutral-600)]">{p.content.guarantee_copy}</p>}
          </div>
        </div>
      </div>
    </Section>
  );
}
