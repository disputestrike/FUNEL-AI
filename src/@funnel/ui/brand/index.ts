/**
 * GoFunnelAI brand exports
 *
 * Single source of truth for logos, icons, tokens.
 * Every app + email template imports from here — never references raw files.
 */

export { Logo, AppIcon, MarketingLogo } from './Logo';
export type { LogoProps, LogoVariant, LogoColor } from './Logo';

/**
 * Logo paths for non-React contexts (email templates, SSR meta tags, OG images).
 * Use absolute CDN URLs in production via cdnLogoUrl().
 *
 * Source files in packages/ui/src/brand/logos/ — copy to each app's /public on build.
 */
export const LOGO_URLS = {
  /** Full marketing logo with color gradient. Use in headers, decks, OG images. */
  color: '/brand/logos/funelai_primary_logo.png',
  /** All-black logo for light backgrounds. */
  black: '/brand/logos/funelai_all_black.png',
  /** All-white logo for dark backgrounds. */
  white: '/brand/logos/funelai_all_white.png',
  /** Square social media profile / app icon source. */
  icon: '/brand/logos/funelai_social_media_profile.png',
  /** Square icon black variant (fallback to social profile if not present). */
  iconBlack: '/brand/logos/funelai_all_black.png',
  /** Square icon white variant (fallback to social profile if not present). */
  iconWhite: '/brand/logos/funelai_all_white.png',
} as const;

/**
 * Production CDN URLs. Set NEXT_PUBLIC_BRAND_CDN once domain + CDN are live.
 */
export function cdnLogoUrl(variant: keyof typeof LOGO_URLS): string {
  const base = process.env.NEXT_PUBLIC_BRAND_CDN ?? 'https://gofunnelai.com';
  return `${base}${LOGO_URLS[variant]}`;
}

/**
 * The official brand name. Always use this string — never hardcode.
 */
export const BRAND_NAME = 'GoFunnelAI';
export const BRAND_DOMAIN = 'gofunnelai.com';
export const BRAND_TAGLINE = 'Type your business. Get a customer.';
