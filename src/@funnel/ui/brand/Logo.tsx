/**
 * GoFunnelAI Logo component
 *
 * Renders the official logo. Auto-picks light vs dark variant based on theme.
 * Source files live in ./logos/ — see logos/README.md for the required filenames.
 *
 * Usage:
 *   <Logo />                           // default: horizontal, theme-aware
 *   <Logo variant="horizontal" />      // horizontal lockup
 *   <Logo variant="icon" />            // icon only
 *   <Logo color="color" />             // force color (purpleâ†’orange gradient)
 *   <Logo color="black" />             // force black
 *   <Logo color="white" />             // force white
 *   <Logo size={64} />                 // custom height (px)
 */

import { type CSSProperties } from 'react';

export type LogoVariant = 'horizontal' | 'icon' | 'wordmark';
export type LogoColor = 'auto' | 'color' | 'black' | 'white';

export interface LogoProps {
  variant?: LogoVariant;
  color?: LogoColor;
  /** Height in pixels. Width is auto. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Alt text. Defaults to "GoFunnelAI". */
  alt?: string;
  /** Mark as decorative (hidden from screen readers). */
  decorative?: boolean;
}

const LOGO_PATHS = {
  horizontal: {
    color: '/brand/logos/funelai_primary_logo.png',
    black: '/brand/logos/funelai_all_black.png',
    white: '/brand/logos/funelai_all_white.png',
  },
  icon: {
    color: '/brand/logos/funelai_social_media_profile.png',
    black: '/brand/logos/funelai_all_black.png',
    white: '/brand/logos/funelai_all_white.png',
  },
  wordmark: {
    color: '/brand/logos/funelai_primary_logo.png',
    black: '/brand/logos/funelai_all_black.png',
    white: '/brand/logos/funelai_all_white.png',
  },
} as const;

const DEFAULT_HEIGHTS = {
  horizontal: 40,
  icon: 32,
  wordmark: 32,
} as const;

/**
 * Resolves logo source path. Picks correct variant based on theme when color="auto".
 * Note: theme detection uses CSS `prefers-color-scheme` via the parent ThemeProvider;
 * we ship both light + dark `<img>` tags wrapped in `<picture>` for SSR safety.
 */
export function Logo({
  variant = 'horizontal',
  color = 'auto',
  size,
  className,
  style,
  alt = 'GoFunnelAI',
  decorative = false,
}: LogoProps): JSX.Element {
  const height = size ?? DEFAULT_HEIGHTS[variant];
  const ariaProps = decorative
    ? { 'aria-hidden': true as const, role: 'presentation' as const }
    : { alt };

  if (color === 'auto') {
    // Theme-aware: render both, CSS picks one
    return (
      <picture className={className} style={style}>
        <source
          srcSet={LOGO_PATHS[variant].white}
          media="(prefers-color-scheme: dark)"
        />
        <img
          src={LOGO_PATHS[variant].black}
          height={height}
          style={{ height, width: 'auto', display: 'block' }}
          {...ariaProps}
        />
      </picture>
    );
  }

  return (
    <img
      src={LOGO_PATHS[variant][color]}
      height={height}
      className={className}
      style={{ height, width: 'auto', display: 'block', ...style }}
      {...ariaProps}
    />
  );
}

/** Convenience: just the icon mark (funnel + lightning). */
export function AppIcon(props: Omit<LogoProps, 'variant'>): JSX.Element {
  return <Logo {...props} variant="icon" />;
}

/** Convenience: full color marketing logo. */
export function MarketingLogo(props: Omit<LogoProps, 'color'>): JSX.Element {
  return <Logo {...props} color="color" />;
}
