import { describe, it, expect } from "vitest";

import {
  WorkspaceSchema,
  LeadSchema,
  PlanSchema,
  FunnelBrandTokensSchema,
} from "../src/schemas/index.js";
import {
  FunnelSchema,
  parseFunnel,
  safeParseFunnel,
} from "../src/funnel-schema.js";
import { FUNNEL_BRAND_TOKENS, PLANS, INDUSTRIES } from "../src/constants/index.js";
import {
  FunnelError,
  ValidationError,
  NotFoundError,
  AuthError,
  BillingError,
  ComplianceError,
  RateLimitError,
  isFunnelError,
} from "../src/errors.js";

describe("workspace schema", () => {
  const good = {
    id: "wsp_01HXABCDEFGHJKMNPQRSTVWXYZ".slice(0, 30),
    slug: "acme",
    name: "Acme",
    owner_user_id: "usr_01HXABCDEFGHJKMNPQRSTVWXYZ".slice(0, 30),
    plan: "growth" as const,
    region: "us-east-1" as const,
    data_residency_lock: false,
    brand_colors: {},
    feature_flags: {},
    ai_training_opt_in: false,
    created_at: "2026-05-25T17:42:01.000Z",
    updated_at: "2026-05-25T17:42:01.000Z",
  };

  it("accepts a well-formed workspace", () => {
    expect(() => WorkspaceSchema.parse(good)).not.toThrow();
  });

  it("rejects invalid plan", () => {
    expect(() => WorkspaceSchema.parse({ ...good, plan: "ultra" })).toThrow();
  });

  it("rejects invalid region", () => {
    expect(() => WorkspaceSchema.parse({ ...good, region: "mars-1" })).toThrow();
  });
});

describe("lead schema", () => {
  const good = {
    id: "lds_01",
    workspace_id: "wsp_01",
    funnel_id: "fnl_01",
    funnel_version_id: "fvr_01",
    status: "new" as const,
    capture_source: "landing_page_form",
    utm: { source: "facebook" },
    attribution_blob: {},
    created_at: "2026-05-25T17:42:01.000Z",
    updated_at: "2026-05-25T17:42:01.000Z",
  };

  it("accepts a well-formed lead", () => {
    expect(() => LeadSchema.parse(good)).not.toThrow();
  });

  it("rejects out-of-range score", () => {
    expect(() => LeadSchema.parse({ ...good, score: 150 })).toThrow();
  });

  it("rejects wrong-length country code", () => {
    expect(() => LeadSchema.parse({ ...good, geo_country: "USA" })).toThrow();
  });
});

describe("plan schema and catalog", () => {
  it("every catalog plan validates", () => {
    for (const p of PLANS) {
      expect(() => PlanSchema.parse(p)).not.toThrow();
    }
  });

  it("free plan has no revtry", () => {
    const free = PLANS.find((p) => p.slug === "free")!;
    expect(free.features.revtry).toBe(false);
  });
});

describe("FunnelBrandTokens catalog validates", () => {
  it("BRAND_TOKENS shape is valid", () => {
    expect(() => FunnelBrandTokensSchema.parse(FUNNEL_BRAND_TOKENS)).not.toThrow();
  });
});

describe("industries catalog", () => {
  it("has 30 entries and unique slugs", () => {
    expect(INDUSTRIES.length).toBe(30);
    const slugs = new Set(INDUSTRIES.map((i) => i.slug));
    expect(slugs.size).toBe(30);
  });
});

// ---- Funnel JSON ---------------------------------------------------------

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";
const VALID_UUID_3 = "33333333-3333-4333-8333-333333333333";

function baseFunnel() {
  return {
    schema_version: "1.0.0",
    metadata: {
      id: VALID_UUID,
      workspace_id: VALID_UUID_2,
      name: "Demo",
      slug: "demo",
      version: "1.0.0",
      status: "draft" as const,
      language: "en-US",
      created_at: "2026-05-25T15:00:00Z",
      updated_at: "2026-05-25T15:00:00Z",
    },
    pages: [
      {
        id: VALID_UUID_3,
        type: "landing" as const,
        sections: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            type: "footer.minimal" as const,
            content: {
              ai_disclosure_required: true,
              links: [{ label: "Privacy", url: "https://example.com/privacy" }],
            },
          },
        ],
        page_metadata: { title: "Demo", description: "Demo" },
      },
    ],
    brand_tokens: FUNNEL_BRAND_TOKENS,
    compliance: {
      ai_disclosure_visible: true,
      regulated_vertical_flag: false,
    },
    provenance: {
      generated_at: "2026-05-25T15:00:00Z",
      model_versions: [{ role: "writer" as const, model: "claude-opus-4-7" }],
      kb_pack_version: "1.0.0",
    },
  };
}

describe("Funnel JSON schema", () => {
  it("accepts a minimal valid funnel", () => {
    const f = baseFunnel();
    expect(() => parseFunnel(f)).not.toThrow();
  });

  it("rejects a regulated funnel missing fact_check_pass_at", () => {
    const f = baseFunnel();
    f.compliance = { ai_disclosure_visible: true, regulated_vertical_flag: true };
    const result = safeParseFunnel(f);
    expect(result.ok).toBe(false);
  });

  it("rejects a landing page with no page_metadata", () => {
    const f = baseFunnel();
    delete (f.pages[0] as { page_metadata?: unknown }).page_metadata;
    const result = safeParseFunnel(f);
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid block content for a typed block", () => {
    const f = baseFunnel();
    f.pages[0]!.sections[0] = {
      id: "55555555-5555-4555-8555-555555555555",
      type: "hero.classic",
      content: { headline: "Hi" }, // missing primary_cta_id, hero_asset_id
    };
    const result = safeParseFunnel(f);
    expect(result.ok).toBe(false);
  });

  it("accepts a fully-formed hero.classic with refs resolvable", () => {
    const ctaId = "66666666-6666-4666-8666-666666666666";
    const assetId = "77777777-7777-4777-8777-777777777777";
    const f = baseFunnel();
    f.pages[0]!.sections.unshift({
      id: "88888888-8888-4888-8888-888888888888",
      type: "hero.classic",
      content: {
        headline: "Cut your bill",
        primary_cta_id: ctaId,
        hero_asset_id: assetId,
      },
    });
    (f as { ctas?: unknown }).ctas = [
      {
        id: ctaId,
        label: "Get a quote",
        action: { type: "form", form_id: ctaId },
      },
    ];
    (f as { assets?: unknown }).assets = [
      {
        id: assetId,
        type: "image",
        url: "https://cdn.example.com/hero.png",
        license_type: "user_uploaded",
        alt_text: "Roof with panels",
      },
    ];
    const result = safeParseFunnel(f);
    expect(result.ok).toBe(true);
  });

  it("rejects dangling cta references", () => {
    const f = baseFunnel();
    f.pages[0]!.sections.unshift({
      id: "99999999-9999-4999-8999-999999999999",
      type: "cta.button-single",
      content: {
        cta_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", // unknown
        alignment: "center",
      },
    });
    // (no ctas array — so the reference is dangling)
    const result = safeParseFunnel(f);
    expect(result.ok).toBe(false);
  });
});

describe("errors", () => {
  it("FunnelError exposes code, status, and details", () => {
    const e = new FunnelError("boom", { code: "internal_error", status: 500, details: { x: 1 } });
    expect(e.code).toBe("internal_error");
    expect(e.status).toBe(500);
    expect(e.details).toEqual({ x: 1 });
    expect(isFunnelError(e)).toBe(true);
  });

  it("subclasses set sane defaults", () => {
    expect(new ValidationError("bad").status).toBe(400);
    expect(new NotFoundError("missing").status).toBe(404);
    expect(new AuthError("nope").status).toBe(401);
    expect(new AuthError("nope", { reason: "forbidden" }).status).toBe(403);
    expect(new BillingError("declined").status).toBe(402);
    expect(new ComplianceError("blocked").status).toBe(422);
    expect(new RateLimitError("slow", { retryAfterSec: 30 }).status).toBe(429);
  });

  it("toJSON returns a serializable shape", () => {
    const e = new ValidationError("bad", { field: "email" });
    const json = JSON.parse(JSON.stringify(e.toJSON()));
    expect(json.code).toBe("validation_error");
    expect(json.status).toBe(400);
    expect(json.details).toEqual({ field: "email" });
  });
});
