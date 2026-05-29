/**
 * Customer conversion ingester — THE FLYWHEEL.
 *
 * Pulls anonymized, opt-in conversion data from the Iceberg lake
 * (see docs/03 Â§C "Data lifecycle"). Specifically, we read from the
 * curated table:
 *
 *     gold.kb_conversion_signals
 *
 * which is populated by a nightly Spark job that joins:
 *   - lead_captured + lead_qualified + lead_booking_created + checkout_paid
 *   - the corresponding FunnelVersion's copy_blob (hooks, headlines, offers)
 *   - the workspace.vertical, region, locale
 *
 * For every funnel that converted in the last 24 h, we summarize:
 *   - "this hook converted at X% on Y leads"
 *   - "this offer beat the median by N pp"
 *
 * which becomes future retrieval material under `ad_angles`,
 * `funnel_archetypes`, and `benchmark_conversion_rates`.
 *
 * This is the moat. The longer GoFunnelAI runs, the better the KB gets, and
 * no competitor can replicate it without our customer data.
 */
import type { IngestionSource, RawIngestedItem } from "./types.js";

export interface ConversionSignalsReader {
  /**
   * Read the latest aggregated conversion signals for a vertical from the
   * Iceberg lake. Implementations: Trino, DuckDB on S3 parquet, or
   * (in tests) a stub returning fixtures.
   */
  read(args: {
    industry: string;
    geo: string;
    language: string;
    since: Date;
    limit: number;
  }): Promise<ConversionSignal[]>;
}

export interface ConversionSignal {
  signal_id: string;
  /** "hook" | "offer" | "lead_magnet" | "form_layout" | "sequence" */
  signal_type: string;
  /** The verbatim asset text (already PII-scrubbed in the lake). */
  asset_text: string;
  /** Aggregated metric attached to this signal. */
  metric: {
    /** "ctr" | "opt_in_rate" | "booking_rate" | "close_rate". */
    name: string;
    /** Value in [0, 1]. */
    value: number;
    /** Sample size — never emit a signal with n < 30. */
    n: number;
    /** Median across vertical for comparison. */
    median: number;
  };
  /** When the underlying conversion event(s) occurred. */
  observed_at: Date;
  /** Workspace-level salt is already applied; safe to publish. */
  funnel_archetype: string;
}

export function createCustomerConversionIngester(
  reader: ConversionSignalsReader,
): IngestionSource {
  return {
    name: "customer_conversion",
    async run(ctx) {
      const since = new Date(ctx.now().getTime() - 24 * 60 * 60 * 1000);
      let signals: ConversionSignal[] = [];
      try {
        signals = await reader.read({
          industry: ctx.industry,
          geo: ctx.geo,
          language: ctx.language,
          since,
          limit: ctx.max_items,
        });
      } catch (err) {
        ctx.log("error", "customer_conversion read failed", { err: String(err) });
        return [];
      }

      const items: RawIngestedItem[] = signals
        .filter((s) => s.metric.n >= 30 && s.metric.value > 0)
        .slice(0, ctx.max_items)
        .map((s) => {
          const lift = s.metric.value - s.metric.median;
          const section =
            s.signal_type === "hook"
              ? "ad_angles"
              : s.signal_type === "offer"
                ? "offers"
                : s.signal_type === "lead_magnet"
                  ? "lead_magnets"
                  : s.signal_type === "sequence"
                    ? "email_sequences"
                    : "funnel_archetypes";
          const body = [
            `Signal type: ${s.signal_type}`,
            `Archetype: ${s.funnel_archetype}`,
            `Metric: ${s.metric.name}=${(s.metric.value * 100).toFixed(2)}% (n=${s.metric.n}), median=${(s.metric.median * 100).toFixed(2)}%, lift=${(lift * 100).toFixed(2)} pp`,
            `Asset:`,
            s.asset_text,
          ].join("\n");
          return {
            external_id: `conv:${s.signal_id}`,
            industry: ctx.industry,
            geo: ctx.geo,
            language: ctx.language,
            section,
            content: body,
            title: `Conversion signal: ${s.signal_type}`,
            source_url: null,
            source: "customer_conversion" as const,
            published_at: s.observed_at,
            license: "funnel-ai-internal",
            raw: { metric: s.metric, archetype: s.funnel_archetype },
          };
        });

      ctx.log("info", `customer_conversion: ${items.length} signals for ${ctx.industry}`);
      return items;
    },
  };
}
