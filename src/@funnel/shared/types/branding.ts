/**
 * BrandTokens — the design tokens per doc 22 (Brand and Design System).
 *
 * Every Funnel carries a `BrandTokens` block so templates can travel with
 * their own identity. The renderer injects these as CSS variables at the
 * funnel root; the AI generation engine reads them to keep generated copy
 * and components on-brand.
 *
 * The canonical default values live in `constants/brand-tokens.ts`.
 */

export type HexColor = string; // matches `^#(?:[0-9a-fA-F]{3,8})$`

export interface ColorScale {
  "50"?: HexColor;
  "100"?: HexColor;
  "200"?: HexColor;
  "300"?: HexColor;
  "400"?: HexColor;
  "500": HexColor; // required — the canonical token
  "600"?: HexColor;
  "700"?: HexColor;
  "800"?: HexColor;
  "900"?: HexColor;
}

export interface SemanticColors {
  success: HexColor;
  warning: HexColor;
  error: HexColor;
  info: HexColor;
}

export interface BrandColors {
  primary: ColorScale;
  secondary: ColorScale;
  accent: ColorScale;
  neutral: ColorScale;
  semantic: SemanticColors;
}

export interface FontFamilies {
  heading_display: string;
  heading_text?: string;
  body: string;
  mono?: string;
}

export interface FontSizes {
  xs?: string;
  sm?: string;
  base?: string;
  lg?: string;
  xl?: string;
  h6?: string;
  h5?: string;
  h4?: string;
  h3?: string;
  h2?: string;
  h1?: string;
  display?: string;
}

export interface FontWeights {
  regular: number;
  medium: number;
  semibold: number;
  bold: number;
}

export interface LineHeights {
  tight?: number;
  snug?: number;
  normal?: number;
  relaxed?: number;
  loose?: number;
}

export interface LetterSpacings {
  tighter?: string;
  tight?: string;
  normal?: string;
  wide?: string;
  wider?: string;
}

export interface Typography {
  font_families: FontFamilies;
  font_sizes: FontSizes;
  font_weights: FontWeights;
  line_heights: LineHeights;
  letter_spacings?: LetterSpacings;
}

/**
 * Spacing maps token name -> rem value. Token names: "0","1","2","4","6","8",
 * "12","16","24","32","48","64","96" (corresponding to a 4/8px scale).
 */
export type SpacingScale = Record<string, string>;

export interface BorderRadius {
  none?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  full?: string;
}

export interface Shadows {
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  glow?: string;
}

export interface Motion {
  durations?: {
    fastest?: string;
    faster?: string;
    fast?: string;
    normal?: string;
    slow?: string;
  };
  easings?: {
    ease_out?: string;
    ease_in_out?: string;
    bouncy?: string;
  };
}

export interface ZIndex {
  base?: number;
  raised?: number;
  dropdown?: number;
  sticky?: number;
  overlay?: number;
  modal?: number;
  popover?: number;
  toast?: number;
}

/**
 * Funnel-schema brand tokens (the structured tree per doc 18 / doc 22).
 *
 * Named `FunnelBrandTokens` to avoid colliding with the legacy flat
 * `BrandTokens` constant exported from `constants/brand.ts` (used by the
 * Funnel Grader app). New code targeting the funnel schema should import
 * this type.
 */
export interface FunnelBrandTokens {
  colors: BrandColors;
  typography: Typography;
  spacing: SpacingScale;
  border_radius: BorderRadius;
  shadows: Shadows;
  motion?: Motion;
  z_index?: ZIndex;
}
