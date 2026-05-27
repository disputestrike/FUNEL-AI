# @funnel/shared

GoFunnelAI shared types, schemas, constants, and utilities.

This package is the contract between every other package in the monorepo. If
a type, schema, or constant is used by more than one package, it lives here.

## What's inside

- **`src/types/`** â€” TypeScript types for every domain object (workspace,
  user, funnel, CRM, billing, compliance, branding, persona, industry,
  generation). One file per concept.
- **`src/schemas/`** â€” Zod runtime validators for the same domain objects.
  Mirrors `src/types`. Also contains the legacy Funnel Grader schemas (kept
  for the grader app).
- **`src/funnel-schema.ts`** â€” the full Funnel JSON Schema as Zod (doc 18).
  Contains the 60-block type enum, 8 typed block content schemas, and the
  cross-reference integrity validator.
- **`src/constants/`** â€” the 30 launch industries, 10 launch languages,
  10 launch countries, 5 subscription plans, the brand tokens, and the
  5 voice personas (doc 22 / doc 20).
- **`src/utils/`** â€” `id` (ULID generation with prefixes), `pii` (hash,
  redact, normalize), `money` (typed micros-based currency with no float
  bugs), `time` (timezone helpers), `slug` (URL-safe slugs).
- **`src/errors.ts`** â€” typed error hierarchy: `FunnelError` â†’
  `ValidationError | NotFoundError | AuthError | BillingError | ComplianceError | RateLimitError | UpstreamError | ConflictError`.

## Usage

```ts
import {
  // Types
  type Workspace, type Lead, type Funnel, Role,
  // Constants
  INDUSTRIES, LANGUAGES, COUNTRIES, PLANS, FUNNEL_BRAND_TOKENS, PERSONAS,
  // Utils
  prefixedId, slugify, money, formatMoney, hashEmail, redactPII, nowIso,
  // Errors
  ValidationError, NotFoundError,
  // Funnel schema
  FunnelSchema, parseFunnel, safeParseFunnel,
} from "@funnel/shared";
```

Or via the subpath exports:

```ts
import type { Workspace } from "@funnel/shared/types";
import { prefixedId } from "@funnel/shared/utils";
import { FunnelSchema } from "@funnel/shared/funnel-schema";
```

## Money handling

Always use the `Money` type â€” never store amounts as floating point.

```ts
import { money, add, formatMoney } from "@funnel/shared";

const subtotal = money(199, "USD");
const tax = money("12.34", "USD");
const total = add(subtotal, tax);
formatMoney(total);                                // "$211.34"
formatMoney(total, { hideTrailingZeroCents: true }); // "$211.34"
formatMoney(money(200, "USD"), { hideTrailingZeroCents: true }); // "$200"
```

## IDs

All entities are identified by prefixed ULIDs â€” sortable, URL-safe,
collision-resistant.

```ts
import { prefixedId, isPrefixedId } from "@funnel/shared";

const id = prefixedId("workspace"); // "wsp_01HXABCDEFGHJKMNPQRSTVWXYZ"
isPrefixedId(id, "workspace"); // true
```

Prefix table is in `src/utils/id.ts`. Add new prefixes there when you add a
new entity.

## Funnel schema

The canonical funnel JSON validator. Use this anywhere a `Funnel` object
crosses a trust boundary (API request body, KB pack output, importer input).

```ts
import { parseFunnel, safeParseFunnel } from "@funnel/shared";

// throws ZodError on failure
const f = parseFunnel(input);

// or
const result = safeParseFunnel(input);
if (!result.ok) { /* result.issues is ZodIssue[] */ }
```

Block content for the 8 most common blocks (`hero.classic`,
`form.classic-3-field`, `proof.testimonial-grid`, `offer.value-stack`,
`cta.button-single`, `content.faq`, `content.video-embed`, `footer.minimal`)
is fully typed and validated. Adding a new block content schema is a single
entry in `BLOCK_CONTENT_SCHEMAS`.

## Tests

```bash
pnpm --filter @funnel/shared test
```
