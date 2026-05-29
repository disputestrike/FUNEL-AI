import * as React from "react";
import type { BlockBaseProps } from "../funnel-blocks/types";

// Hero
import { HeroBenefitDriven } from "../funnel-blocks/hero/HeroBenefitDriven";
import { HeroClassic } from "../funnel-blocks/hero/HeroClassic";
import { HeroMinimal } from "../funnel-blocks/hero/HeroMinimal";
import { HeroSplit } from "../funnel-blocks/hero/HeroSplit";
import { HeroUrgency } from "../funnel-blocks/hero/HeroUrgency";
import { HeroVideo } from "../funnel-blocks/hero/HeroVideo";

// Form
import { FormCalculator } from "../funnel-blocks/form/FormCalculator";
import { FormClassic3Field } from "../funnel-blocks/form/FormClassic3Field";
import { FormConsultationBooking } from "../funnel-blocks/form/FormConsultationBooking";
import { FormInlineSingleField } from "../funnel-blocks/form/FormInlineSingleField";
import { FormLong7Field } from "../funnel-blocks/form/FormLong7Field";
import { FormMultiStep } from "../funnel-blocks/form/FormMultiStep";
import { FormPayment } from "../funnel-blocks/form/FormPayment";
import { FormQuiz } from "../funnel-blocks/form/FormQuiz";

// Proof
import { ProofBeforeAfter } from "../funnel-blocks/proof/ProofBeforeAfter";
import { ProofCaseStudySummary } from "../funnel-blocks/proof/ProofCaseStudySummary";
import { ProofLogoBar } from "../funnel-blocks/proof/ProofLogoBar";
import { ProofReviewSnippet } from "../funnel-blocks/proof/ProofReviewSnippet";
import { ProofStatRow } from "../funnel-blocks/proof/ProofStatRow";
import { ProofTestimonialGrid } from "../funnel-blocks/proof/ProofTestimonialGrid";
import { ProofTestimonialSingleLarge } from "../funnel-blocks/proof/ProofTestimonialSingleLarge";
import { ProofVideoTestimonial } from "../funnel-blocks/proof/ProofVideoTestimonial";

// Offer
import { OfferBenefitList } from "../funnel-blocks/offer/OfferBenefitList";
import { OfferBundleSavings } from "../funnel-blocks/offer/OfferBundleSavings";
import { OfferComparisonTable } from "../funnel-blocks/offer/OfferComparisonTable";
import { OfferFeatureGrid } from "../funnel-blocks/offer/OfferFeatureGrid";
import { OfferLimitedTime } from "../funnel-blocks/offer/OfferLimitedTime";
import { OfferPricingTiers } from "../funnel-blocks/offer/OfferPricingTiers";
import { OfferSingleCard } from "../funnel-blocks/offer/OfferSingleCard";
import { OfferValueStack } from "../funnel-blocks/offer/OfferValueStack";

// CTA
import { CtaBanner } from "../funnel-blocks/cta/CtaBanner";
import { CtaButtonPair } from "../funnel-blocks/cta/CtaButtonPair";
import { CtaButtonSingle } from "../funnel-blocks/cta/CtaButtonSingle";
import { CtaFloating } from "../funnel-blocks/cta/CtaFloating";

// Content
import { ContentBulletList } from "../funnel-blocks/content/ContentBulletList";
import { ContentCodeSnippet } from "../funnel-blocks/content/ContentCodeSnippet";
import { ContentFaq } from "../funnel-blocks/content/ContentFaq";
import { ContentGallery } from "../funnel-blocks/content/ContentGallery";
import { ContentImage } from "../funnel-blocks/content/ContentImage";
import { ContentQuote } from "../funnel-blocks/content/ContentQuote";
import { ContentTextBlock } from "../funnel-blocks/content/ContentTextBlock";
import { ContentVideoEmbed } from "../funnel-blocks/content/ContentVideoEmbed";

// Trust
import { TrustBadgeRow } from "../funnel-blocks/trust/TrustBadgeRow";
import { TrustCertification } from "../funnel-blocks/trust/TrustCertification";
import { TrustCompliance } from "../funnel-blocks/trust/TrustCompliance";
import { TrustGuarantee } from "../funnel-blocks/trust/TrustGuarantee";
import { TrustHistory } from "../funnel-blocks/trust/TrustHistory";
import { TrustTeam } from "../funnel-blocks/trust/TrustTeam";

// Interactive
import { InteractiveCalculator } from "../funnel-blocks/interactive/InteractiveCalculator";
import { InteractiveCalendarBookingEmbed } from "../funnel-blocks/interactive/InteractiveCalendarBookingEmbed";
import { InteractiveCountdownTimer } from "../funnel-blocks/interactive/InteractiveCountdownTimer";
import { InteractiveLiveChatEmbed } from "../funnel-blocks/interactive/InteractiveLiveChatEmbed";
import { InteractiveProductFinder } from "../funnel-blocks/interactive/InteractiveProductFinder";
import { InteractiveVideoWithCtaOverlay } from "../funnel-blocks/interactive/InteractiveVideoWithCtaOverlay";

// Footer
import { FooterFull } from "../funnel-blocks/footer/FooterFull";
import { FooterMinimal } from "../funnel-blocks/footer/FooterMinimal";

// Specialty
import { SpecialtyContestEntry } from "../funnel-blocks/specialty/SpecialtyContestEntry";
import { SpecialtyLeadMagnetDelivery } from "../funnel-blocks/specialty/SpecialtyLeadMagnetDelivery";
import { SpecialtyReferralProgramSignup } from "../funnel-blocks/specialty/SpecialtyReferralProgramSignup";
import { SpecialtyWebinarRegistration } from "../funnel-blocks/specialty/SpecialtyWebinarRegistration";

/**
 * Loose type for any block component. Each block component takes `content` plus
 * BlockBaseProps and returns JSX. The renderer doesn't need to narrow the
 * content shape — each block handles its own content type internally.
 */
export type BlockComponent = (props: BlockBaseProps & { content: any; variant?: string }) => JSX.Element | null;

/**
 * Registry mapping every `block_type` string to its renderer component. All 60
 * canonical block types are covered. The registry is the single source of
 * truth: adding a new block = adding a row here.
 */
export const BlockRegistry: Record<string, BlockComponent> = {
  // hero (6)
  "hero.classic": HeroClassic as unknown as BlockComponent,
  "hero.video": HeroVideo as unknown as BlockComponent,
  "hero.split": HeroSplit as unknown as BlockComponent,
  "hero.minimal": HeroMinimal as unknown as BlockComponent,
  "hero.benefit-driven": HeroBenefitDriven as unknown as BlockComponent,
  "hero.urgency": HeroUrgency as unknown as BlockComponent,
  // form (8)
  "form.inline-single-field": FormInlineSingleField as unknown as BlockComponent,
  "form.classic-3-field": FormClassic3Field as unknown as BlockComponent,
  "form.long-7-field": FormLong7Field as unknown as BlockComponent,
  "form.multi-step": FormMultiStep as unknown as BlockComponent,
  "form.calculator": FormCalculator as unknown as BlockComponent,
  "form.quiz": FormQuiz as unknown as BlockComponent,
  "form.consultation-booking": FormConsultationBooking as unknown as BlockComponent,
  "form.payment": FormPayment as unknown as BlockComponent,
  // proof (8)
  "proof.testimonial-grid": ProofTestimonialGrid as unknown as BlockComponent,
  "proof.testimonial-single-large": ProofTestimonialSingleLarge as unknown as BlockComponent,
  "proof.logo-bar": ProofLogoBar as unknown as BlockComponent,
  "proof.stat-row": ProofStatRow as unknown as BlockComponent,
  "proof.before-after": ProofBeforeAfter as unknown as BlockComponent,
  "proof.case-study-summary": ProofCaseStudySummary as unknown as BlockComponent,
  "proof.video-testimonial": ProofVideoTestimonial as unknown as BlockComponent,
  "proof.review-snippet": ProofReviewSnippet as unknown as BlockComponent,
  // offer (8)
  "offer.feature-grid": OfferFeatureGrid as unknown as BlockComponent,
  "offer.benefit-list": OfferBenefitList as unknown as BlockComponent,
  "offer.comparison-table": OfferComparisonTable as unknown as BlockComponent,
  "offer.value-stack": OfferValueStack as unknown as BlockComponent,
  "offer.pricing-tiers": OfferPricingTiers as unknown as BlockComponent,
  "offer.single-card": OfferSingleCard as unknown as BlockComponent,
  "offer.bundle-savings": OfferBundleSavings as unknown as BlockComponent,
  "offer.limited-time": OfferLimitedTime as unknown as BlockComponent,
  // cta (4)
  "cta.button-single": CtaButtonSingle as unknown as BlockComponent,
  "cta.button-pair": CtaButtonPair as unknown as BlockComponent,
  "cta.banner": CtaBanner as unknown as BlockComponent,
  "cta.floating": CtaFloating as unknown as BlockComponent,
  // content (8)
  "content.text-block": ContentTextBlock as unknown as BlockComponent,
  "content.faq": ContentFaq as unknown as BlockComponent,
  "content.video-embed": ContentVideoEmbed as unknown as BlockComponent,
  "content.image": ContentImage as unknown as BlockComponent,
  "content.gallery": ContentGallery as unknown as BlockComponent,
  "content.code-snippet": ContentCodeSnippet as unknown as BlockComponent,
  "content.quote": ContentQuote as unknown as BlockComponent,
  "content.bullet-list": ContentBulletList as unknown as BlockComponent,
  // trust (6)
  "trust.badge-row": TrustBadgeRow as unknown as BlockComponent,
  "trust.guarantee": TrustGuarantee as unknown as BlockComponent,
  "trust.certification": TrustCertification as unknown as BlockComponent,
  "trust.team": TrustTeam as unknown as BlockComponent,
  "trust.history": TrustHistory as unknown as BlockComponent,
  "trust.compliance": TrustCompliance as unknown as BlockComponent,
  // interactive (6)
  "interactive.countdown-timer": InteractiveCountdownTimer as unknown as BlockComponent,
  "interactive.calculator": InteractiveCalculator as unknown as BlockComponent,
  "interactive.product-finder": InteractiveProductFinder as unknown as BlockComponent,
  "interactive.live-chat-embed": InteractiveLiveChatEmbed as unknown as BlockComponent,
  "interactive.calendar-booking-embed": InteractiveCalendarBookingEmbed as unknown as BlockComponent,
  "interactive.video-with-cta-overlay": InteractiveVideoWithCtaOverlay as unknown as BlockComponent,
  // footer (2)
  "footer.minimal": FooterMinimal as unknown as BlockComponent,
  "footer.full": FooterFull as unknown as BlockComponent,
  // specialty (4)
  "specialty.lead-magnet-delivery": SpecialtyLeadMagnetDelivery as unknown as BlockComponent,
  "specialty.webinar-registration": SpecialtyWebinarRegistration as unknown as BlockComponent,
  "specialty.contest-entry": SpecialtyContestEntry as unknown as BlockComponent,
  "specialty.referral-program-signup": SpecialtyReferralProgramSignup as unknown as BlockComponent,
};

/**
 * Total blocks registered. Should equal 60 (the canonical count in
 * `BLOCK_TYPES`).
 */
export const REGISTERED_BLOCK_COUNT = Object.keys(BlockRegistry).length;

export function getBlockComponent(type: string): BlockComponent | undefined {
  return BlockRegistry[type];
}
