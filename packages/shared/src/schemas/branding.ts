/**
 * Zod schemas for the FunnelBrandTokens tree (doc 22).
 *
 * The funnel-schema brand tokens object is union-typed and large; these
 * schemas are the canonical validators.
 */

import { z } from "zod";

const HexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

export const ColorScaleSchema = z
  .object({
    "50": HexColor.optional(),
    "100": HexColor.optional(),
    "200": HexColor.optional(),
    "300": HexColor.optional(),
    "400": HexColor.optional(),
    "500": HexColor, // required canonical token
    "600": HexColor.optional(),
    "700": HexColor.optional(),
    "800": HexColor.optional(),
    "900": HexColor.optional(),
  })
  .strict();

export const SemanticColorsSchema = z
  .object({
    success: HexColor,
    warning: HexColor,
    error: HexColor,
    info: HexColor,
  })
  .strict();

export const BrandColorsSchema = z
  .object({
    primary: ColorScaleSchema,
    secondary: ColorScaleSchema,
    accent: ColorScaleSchema,
    neutral: ColorScaleSchema,
    semantic: SemanticColorsSchema,
  })
  .strict();

export const FontFamiliesSchema = z
  .object({
    heading_display: z.string().max(80),
    heading_text: z.string().max(80).optional(),
    body: z.string().max(80),
    mono: z.string().max(80).optional(),
  })
  .strict();

export const FontWeightsSchema = z
  .object({
    regular: z.number().int().min(100).max(900),
    medium: z.number().int().min(100).max(900),
    semibold: z.number().int().min(100).max(900),
    bold: z.number().int().min(100).max(900),
  })
  .strict();

export const TypographySchema = z
  .object({
    font_families: FontFamiliesSchema,
    font_sizes: z.record(z.string()),
    font_weights: FontWeightsSchema,
    line_heights: z.record(z.number()),
    letter_spacings: z.record(z.string()).optional(),
  })
  .passthrough();

export const BorderRadiusSchema = z
  .object({
    none: z.string().optional(),
    sm: z.string().optional(),
    md: z.string().optional(),
    lg: z.string().optional(),
    xl: z.string().optional(),
    full: z.string().optional(),
  })
  .strict();

export const ShadowsSchema = z
  .object({
    sm: z.string().optional(),
    md: z.string().optional(),
    lg: z.string().optional(),
    xl: z.string().optional(),
    glow: z.string().optional(),
  })
  .strict();

export const MotionSchema = z
  .object({
    durations: z
      .object({
        fastest: z.string().optional(),
        faster: z.string().optional(),
        fast: z.string().optional(),
        normal: z.string().optional(),
        slow: z.string().optional(),
      })
      .optional(),
    easings: z
      .object({
        ease_out: z.string().optional(),
        ease_in_out: z.string().optional(),
        bouncy: z.string().optional(),
      })
      .optional(),
  })
  .strict();

export const ZIndexSchema = z
  .object({
    base: z.number().int().optional(),
    raised: z.number().int().optional(),
    dropdown: z.number().int().optional(),
    sticky: z.number().int().optional(),
    overlay: z.number().int().optional(),
    modal: z.number().int().optional(),
    popover: z.number().int().optional(),
    toast: z.number().int().optional(),
  })
  .strict();

export const FunnelBrandTokensSchema = z
  .object({
    colors: BrandColorsSchema,
    typography: TypographySchema,
    spacing: z.record(z.string()),
    border_radius: BorderRadiusSchema,
    shadows: ShadowsSchema,
    motion: MotionSchema.optional(),
    z_index: ZIndexSchema.optional(),
  })
  .strict();
