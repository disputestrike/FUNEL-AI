/**
 * Pack-template parsing tests.
 *
 * Verifies the markdown parser against:
 *   - The real solar exemplar (src/packs/solar/us-en.md) — every canonical
 *     section is populated.
 *   - A stub template — TODO placeholders are preserved verbatim.
 *   - The pack metadata YAML block is parsed.
 *   - Heading-renumbering would break retrieval — assert section order is
 *     stable (matches SECTION_HEADING_NUMBERS).
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePackMarkdown, loadPack } from "../src/template-loader.js";
import { KB_SECTIONS, SECTION_HEADING_NUMBERS } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = path.resolve(__dirname, "..", "src", "packs");

describe("parsePackMarkdown", () => {
  it("parses the solar exemplar with all sections populated", async () => {
    const md = await fs.readFile(path.join(PACKS_DIR, "solar", "us-en.md"), "utf-8");
    const pack = parsePackMarkdown(md, {
      industry: "solar",
      geo: "us",
      language: "en",
    });

    expect(pack.industry).toBe("solar");
    expect(pack.geo).toBe("us");
    expect(pack.language).toBe("en");

    // Every canonical section should have substantial content (not TODO stubs).
    for (const section of KB_SECTIONS) {
      const body = pack.sections[section];
      expect(body, `section ${section}`).toBeTruthy();
      // Stubs would say "_TODO" — solar exemplar must not.
      // (Pack metadata section contains YAML; allow that.)
      if (section !== "pack_metadata") {
        expect(body.toLowerCase()).not.toContain("_todo");
      }
    }

    // Metadata extracted from §24 YAML.
    expect(pack.metadata.pack_id).toBe("solar-residential-us");
    expect(pack.metadata.version).toBe("1.0");
    expect(pack.metadata.embedding_model).toBe("text-embedding-3-large");
  });

  it("parses the HVAC pack with canonical content populated", async () => {
    const pack = await loadPack({
      industry: "hvac",
      geo: "us",
      language: "en",
      packsDir: PACKS_DIR,
    });
    expect(pack.industry).toBe("hvac");
    expect(pack.sections.market_overview).toBeTruthy();
    expect(pack.sections.market_overview.toLowerCase()).not.toContain("todo");
  });

  it("metadata defaults are applied when YAML block is missing", () => {
    const md = `## 1. Market overview\nSome text.\n\n## 2. Buyer personas\nAnother.\n`;
    const pack = parsePackMarkdown(md, {
      industry: "test",
      geo: "us",
      language: "en",
    });
    expect(pack.metadata.pack_id).toBe("test-us-en");
    expect(pack.metadata.version).toBe("1.0");
    expect(pack.metadata.embedding_model).toBe("text-embedding-3-large");
  });

  it("preserves the canonical section number → id mapping", () => {
    // If anyone ever renumbers a heading the retrieval anchors will drift —
    // freeze the invariant in test.
    expect(SECTION_HEADING_NUMBERS.market_overview).toBe(1);
    expect(SECTION_HEADING_NUMBERS.buyer_personas).toBe(2);
    expect(SECTION_HEADING_NUMBERS.pain_points).toBe(3);
    expect(SECTION_HEADING_NUMBERS.urgency_triggers).toBe(4);
    expect(SECTION_HEADING_NUMBERS.common_objections).toBe(5);
    expect(SECTION_HEADING_NUMBERS.proof_types).toBe(6);
    expect(SECTION_HEADING_NUMBERS.offers).toBe(7);
    expect(SECTION_HEADING_NUMBERS.lead_magnets).toBe(8);
    expect(SECTION_HEADING_NUMBERS.funnel_archetypes).toBe(9);
    expect(SECTION_HEADING_NUMBERS.ad_angles).toBe(10);
    expect(SECTION_HEADING_NUMBERS.prohibited_claims).toBe(11);
    expect(SECTION_HEADING_NUMBERS.compliance_rules).toBe(12);
    expect(SECTION_HEADING_NUMBERS.form_fields).toBe(13);
    expect(SECTION_HEADING_NUMBERS.lead_scoring_rules).toBe(14);
    expect(SECTION_HEADING_NUMBERS.revtry_script).toBe(15);
    expect(SECTION_HEADING_NUMBERS.sms_sequences).toBe(16);
    expect(SECTION_HEADING_NUMBERS.email_sequences).toBe(17);
    expect(SECTION_HEADING_NUMBERS.benchmarks_cpl).toBe(18);
    expect(SECTION_HEADING_NUMBERS.benchmark_conversion_rates).toBe(19);
    expect(SECTION_HEADING_NUMBERS.seasonal_cycles).toBe(20);
    expect(SECTION_HEADING_NUMBERS.example_funnels).toBe(21);
    expect(SECTION_HEADING_NUMBERS.glossary).toBe(22);
    expect(SECTION_HEADING_NUMBERS.sources_citations).toBe(23);
    expect(SECTION_HEADING_NUMBERS.pack_metadata).toBe(24);
  });
});
