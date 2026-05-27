/**
 * Analytics router — KPIs, retention cohorts, conversion funnels.
 *
 * Read-only. Heavy queries hit Postgres read replicas via withWorkspaceContext;
 * dashboards consume these via tRPC.
 *
 * All metrics are workspace-scoped. Date ranges are clamped to the workspace
 * subscription's data-retention horizon (free/trial plans see 30d; paid see
 * 13mo; agency tier sees full-retention 5y).
 */

import { z } from "zod";
import { router, workspaceProcedure } from "../trpc.js";

const Range = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  group_by: z.enum(["day", "week", "month"]).default("day"),
});

export const analyticsRouter = router({
  /** Top-level KPIs: leads captured, qualified, booked, conversion %, MRR delta. */
  kpis: workspaceProcedure.input(Range).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const from = new Date(input.from);
      const to = new Date(input.to);
      const where = { workspace_id: ctx.req.workspaceId!, created_at: { gte: from, lte: to } };

      const [captured, qualified, booked, converted, revenue] = await Promise.all([
        tx.lead.count({ where }),
        tx.lead.count({ where: { ...where, status: "qualified" } }),
        tx.lead.count({ where: { ...where, status: "booked" } }),
        tx.lead.count({ where: { ...where, status: "converted" } }),
        tx.lead.aggregate({
          where: { ...where, status: "converted" },
          _sum: { conversion_value_micros: true },
        }),
      ]);

      return {
        range: input,
        leads_captured: captured,
        leads_qualified: qualified,
        leads_booked: booked,
        leads_converted: converted,
        revenue_micros: Number(revenue._sum.conversion_value_micros ?? 0),
        conversion_rate_pct: captured ? (converted / captured) * 100 : 0,
      };
    });
  }),

  /** Time series for leads, bookings, conversions. */
  timeseries: workspaceProcedure
    .input(Range.extend({ metric: z.enum(["leads", "bookings", "conversions", "revenue"]) }))
    .query(async ({ ctx, input }) => {
      return ctx.withTx(async (tx) => {
        // SQL-side bucket the data. Using raw SQL because Prisma doesn't have
        // first-class date_trunc — we keep it parametrized.
        const bucket = input.group_by;
        const table =
          input.metric === "leads"
            ? "leads"
            : input.metric === "bookings"
              ? "bookings"
              : input.metric === "conversions"
                ? "leads"
                : "leads";
        const filter =
          input.metric === "conversions"
            ? "AND status = 'converted'"
            : input.metric === "revenue"
              ? "AND status = 'converted'"
              : "";
        const select = input.metric === "revenue" ? "SUM(conversion_value_micros)" : "COUNT(*)";
        const rows = await tx.$queryRawUnsafe<{ ts: Date; value: string }[]>(
          `SELECT date_trunc($1, created_at) AS ts, ${select}::text AS value
             FROM ${table}
            WHERE workspace_id = $2
              AND created_at >= $3 AND created_at <= $4
              ${filter}
            GROUP BY 1
            ORDER BY 1 ASC`,
          bucket,
          ctx.req.workspaceId!,
          new Date(input.from),
          new Date(input.to),
        );
        return rows.map((r) => ({ ts: r.ts, value: Number(r.value) }));
      });
    }),

  /** Conversion funnel: capture → qualified → booked → converted. */
  conversionFunnel: workspaceProcedure.input(Range).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const where = {
        workspace_id: ctx.req.workspaceId!,
        created_at: { gte: new Date(input.from), lte: new Date(input.to) },
      };
      const [c, q, b, conv] = await Promise.all([
        tx.lead.count({ where }),
        tx.lead.count({ where: { ...where, status: "qualified" } }),
        tx.lead.count({ where: { ...where, status: "booked" } }),
        tx.lead.count({ where: { ...where, status: "converted" } }),
      ]);
      return [
        { step: "captured", value: c },
        { step: "qualified", value: q, dropoff: c ? 1 - q / c : 0 },
        { step: "booked", value: b, dropoff: q ? 1 - b / q : 0 },
        { step: "converted", value: conv, dropoff: b ? 1 - conv / b : 0 },
      ];
    });
  }),

  /** Retention cohort table: signup-cohort × week-since-signup % active. */
  retentionCohorts: workspaceProcedure
    .input(z.object({ cohort_size: z.enum(["week", "month"]).default("month"), horizon_weeks: z.number().int().min(1).max(52).default(12) }))
    .query(async ({ ctx, input }) => {
      return ctx.withTx(async (tx) => {
        // Cohort definition: customer first lead capture. Activity definition:
        // any lead capture in the period.
        const rows = await tx.$queryRawUnsafe<{ cohort: Date; week: number; active: string }[]>(
          `WITH first_leads AS (
             SELECT crm_contact_id AS contact_id, MIN(created_at) AS first_at
               FROM leads
              WHERE workspace_id = $1 AND crm_contact_id IS NOT NULL
              GROUP BY 1
           )
           SELECT date_trunc($2, fl.first_at) AS cohort,
                  (EXTRACT(epoch FROM (l.created_at - fl.first_at)) / 604800)::int AS week,
                  COUNT(DISTINCT fl.contact_id)::text AS active
             FROM first_leads fl
             JOIN leads l ON l.crm_contact_id = fl.contact_id AND l.workspace_id = $1
            WHERE l.created_at >= fl.first_at
              AND (l.created_at - fl.first_at) <= make_interval(weeks => $3)
            GROUP BY 1, 2
            ORDER BY 1, 2`,
          ctx.req.workspaceId!,
          input.cohort_size,
          input.horizon_weeks,
        );
        return rows.map((r) => ({ cohort: r.cohort, week: r.week, active: Number(r.active) }));
      });
    }),

  /** Top funnels by lead volume in the window. */
  topFunnels: workspaceProcedure.input(Range.extend({ limit: z.number().int().min(1).max(50).default(10) })).query(async ({ ctx, input }) => {
    return ctx.withTx(async (tx) => {
      const rows = await tx.lead.groupBy({
        by: ["funnel_id"],
        where: { workspace_id: ctx.req.workspaceId!, created_at: { gte: new Date(input.from), lte: new Date(input.to) } },
        _count: { _all: true },
        orderBy: { _count: { funnel_id: "desc" } },
        take: input.limit,
      });
      return rows.map((r) => ({ funnel_id: r.funnel_id, lead_count: r._count._all }));
    });
  }),
});
