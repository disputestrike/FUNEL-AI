/**
 * Anti-gaming + fulfillment tuning constants.
 */

/** Anti-gaming: Bronze requires at least 10 distinct customers to count. */
export const MIN_UNIQUE_CUSTOMERS_BRONZE = 10;

/** Anti-gaming: Bronze requires the funnel to have been live ≥ 14 days. */
export const MIN_DAYS_SINCE_PUBLISH_BRONZE = 14;

/** Per-tier physical fulfillment costs (Doc 16 §3.3 estimates). */
export const PHYSICAL_DELIVERY_BY_TIER = {
  bronze: { item_type: "digital", est_cost_cents: 0, vendor: "n/a" as const },
  silver: { item_type: "certificate", est_cost_cents: 25_00, vendor: "printful" as const },
  gold: { item_type: "plaque", est_cost_cents: 150_00, vendor: "engraving-shop" as const },
  platinum: { item_type: "large_plaque", est_cost_cents: 500_00, vendor: "engraving-shop" as const },
  diamond: { item_type: "trophy", est_cost_cents: 2_000_00, vendor: "crystal-engravers" as const },
} as const;

/** OG image dimensions for social shares. */
export const OG_IMAGE_DIMS = { width: 1200, height: 630 };

/** Public Hall of Fame URL. */
export const HALL_OF_FAME_BASE_URL = "https://gofunnelai.com/wins";
