/**
 * @funnel/db seed script.
 *
 * Creates a deterministic local-dev dataset:
 *   - 4 workspaces (one per plan: free, starter, growth, agency)
 *   - 8 users with various roles (owner, admin, editor, analyst, viewer, billing)
 *   - 5 funnels per workspace (each with a current FunnelVersion)
 *   - 10 CRM contacts + 10 leads + 3 bookings per workspace
 *   - Sample audit log entries spanning each workspace
 *   - 5 industry KB packs (real_estate, coaching, finance, health, legal)
 *   - One Subscription + one paid Invoice + Payment per workspace
 *
 * Run with `pnpm db:seed`. Idempotent: re-running upserts on `id`.
 */
import { factory, monotonicFactory } from "ulid";
import {
  prisma,
  withAdminContext,
  Prisma,
} from "./index.js";
import { newId } from "./ids.js";

type SeedClient = Prisma.TransactionClient;

// ---------------------------------------------------------------------
// Deterministic ULID factory (seed-time stability across re-runs)
// ---------------------------------------------------------------------
const DETERMINISTIC = process.env.SEED_DETERMINISTIC !== "0";
const SEED_EPOCH = 1_704_067_200_000; // 2024-01-01

function makeUlidFactory() {
  if (!DETERMINISTIC) return monotonicFactory();
  // Pseudo-random source seeded by index for reproducibility.
  let counter = 0;
  const prng = () => {
    counter += 1;
    // Simple LCG — good enough for ULID randomness placeholder.
    const x = Math.sin(counter * 9999) * 10000;
    return x - Math.floor(x);
  };
  return factory(prng);
}

const ulid = makeUlidFactory();

function makeId(prefix: string, offset = 0): string {
  if (!DETERMINISTIC) return newId(prefix);
  return `${prefix}_${ulid(SEED_EPOCH + offset)}`;
}

// ---------------------------------------------------------------------
// Static fixtures
// ---------------------------------------------------------------------

const PLAN_CONFIG = [
  { plan: "free", name: "Free Tier Demo", slug: "free-demo", vertical: "real_estate" },
  { plan: "starter", name: "Starter Demo", slug: "starter-demo", vertical: "coaching" },
  { plan: "growth", name: "Growth Demo", slug: "growth-demo", vertical: "finance" },
  { plan: "agency", name: "Agency Demo", slug: "agency-demo", vertical: "health" },
] as const;

const ROLE_USERS = [
  { role: "owner",    fullName: "Avery Owner",    suffix: "owner" },
  { role: "admin",    fullName: "Blair Admin",    suffix: "admin" },
  { role: "editor",   fullName: "Casey Editor",   suffix: "editor" },
  { role: "analyst",  fullName: "Dana Analyst",   suffix: "analyst" },
  { role: "viewer",   fullName: "Erin Viewer",    suffix: "viewer" },
  { role: "billing",  fullName: "Finley Billing", suffix: "billing" },
] as const;

const INDUSTRY_KB_PACKS = [
  {
    vertical: "real_estate",
    name: "Real-Estate Lead Compliance Pack",
    keyTerms: ["fair housing", "RESPA", "TCPA opt-in", "listing disclosures"],
    regulatoryRefs: [
      { law: "Fair Housing Act", jurisdiction: "US-federal" },
      { law: "TCPA",             jurisdiction: "US-federal" },
    ],
  },
  {
    vertical: "coaching",
    name: "Coaching & Course Funnel Pack",
    keyTerms: [
      "FTC endorsement guides",
      "earnings disclaimer",
      "no-medical-advice notice",
    ],
    regulatoryRefs: [
      { law: "FTC Endorsement Guides", jurisdiction: "US-federal" },
    ],
  },
  {
    vertical: "finance",
    name: "Finance/Wealth Vertical Pack",
    keyTerms: [
      "Reg BI",
      "FINRA advertising rules",
      "past performance disclaimer",
      "AML notice",
    ],
    regulatoryRefs: [
      { law: "FINRA Rule 2210", jurisdiction: "US-federal" },
      { law: "SEC Reg BI",      jurisdiction: "US-federal" },
    ],
  },
  {
    vertical: "health",
    name: "Health & Wellness Vertical Pack",
    keyTerms: [
      "HIPAA marketing limits",
      "no-disease-claim language",
      "FDA structure/function claims",
    ],
    regulatoryRefs: [
      { law: "HIPAA",        jurisdiction: "US-federal" },
      { law: "FDA DSHEA",    jurisdiction: "US-federal" },
    ],
  },
  {
    vertical: "legal",
    name: "Legal-Services Vertical Pack",
    keyTerms: [
      "ABA Model Rule 7.1",
      "no-results-guarantee",
      "advertising material disclosure",
    ],
    regulatoryRefs: [
      { law: "ABA Model Rule 7.1", jurisdiction: "US-federal" },
    ],
  },
] as const;

// ---------------------------------------------------------------------
// Main seed routine
// ---------------------------------------------------------------------

async function main() {
  console.log("[seed] starting GoFunnelAI seed");

  await withAdminContext(async (tx) => {
    await seedKbPacks(tx);
    await seedUsers(tx);
    await seedWorkspaces(tx);
  });

  // Workspace-scoped data uses each workspace's own RLS context.
  for (const cfg of PLAN_CONFIG) {
    const wsId = workspaceIdFor(cfg.plan);
    console.log(`[seed]  -> seeding workspace ${cfg.plan} (${wsId})`);
    await withAdminContext(async (tx) => {
      // RLS is bypassed here; we are intentionally writing across rows for fixtures.
      await seedMembers(tx, wsId);
      await seedFunnels(tx, wsId, cfg.vertical);
      await seedCrmAndLeads(tx, wsId);
      await seedBillingFor(tx, wsId, cfg.plan);
      await seedAuditLogFor(tx, wsId);
    });
  }

  console.log("[seed] done");
}

// ---------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------

function workspaceIdFor(plan: string): string {
  // Stable id derived from plan name so the seed is idempotent.
  const planIndex = PLAN_CONFIG.findIndex((c) => c.plan === plan);
  return makeId("wsp", 100 + planIndex);
}

function userIdFor(plan: string, suffix: string): string {
  const planIndex = PLAN_CONFIG.findIndex((c) => c.plan === plan);
  const userIndex = ROLE_USERS.findIndex((u) => u.suffix === suffix);
  return makeId("usr", 200 + planIndex * 10 + userIndex);
}

async function seedKbPacks(tx: SeedClient) {
  for (let i = 0; i < INDUSTRY_KB_PACKS.length; i++) {
    const pack = INDUSTRY_KB_PACKS[i]!;
    const id = makeId("kbp", 50 + i);
    await tx.kbPack.upsert({
      where: { vertical_version: { vertical: pack.vertical, version: "1.0.0" } },
      update: {
        name: pack.name,
        status: "active",
        contentBlob: {
          _schema_version: 1,
          keyTerms: pack.keyTerms,
          summary: `Knowledge pack for ${pack.vertical} compliance and copy guardrails.`,
        },
        regulatoryRefs: pack.regulatoryRefs,
      },
      create: {
        id,
        vertical: pack.vertical,
        version: "1.0.0",
        name: pack.name,
        status: "active",
        contentBlob: {
          _schema_version: 1,
          keyTerms: pack.keyTerms,
          summary: `Knowledge pack for ${pack.vertical} compliance and copy guardrails.`,
        },
        regulatoryRefs: pack.regulatoryRefs,
      },
    });
  }
}

async function seedUsers(tx: SeedClient) {
  for (const cfg of PLAN_CONFIG) {
    for (const u of ROLE_USERS) {
      const id = userIdFor(cfg.plan, u.suffix);
      const email = `${cfg.plan}.${u.suffix}@funnel.test`;
      await tx.user.upsert({
        where: { id },
        update: {
          name: u.fullName,
          status: "active",
        },
        create: {
          id,
          email,
          name: u.fullName,
          locale: "en-US",
          timezone: "America/New_York",
          status: "active",
          isInternal: false,
        },
      });
    }
  }
}

async function seedWorkspaces(tx: SeedClient) {
  for (const cfg of PLAN_CONFIG) {
    const id = workspaceIdFor(cfg.plan);
    const ownerUserId = userIdFor(cfg.plan, "owner");
    await tx.workspace.upsert({
      where: { id },
      update: {
        name: cfg.name,
        slug: cfg.slug,
        plan: cfg.plan,
        vertical: cfg.vertical,
        status: "active",
      },
      create: {
        id,
        slug: cfg.slug,
        name: cfg.name,
        ownerUserId,
        plan: cfg.plan,
        vertical: cfg.vertical,
        status: "active",
        region: "us-east-1",
        brandColors: { primary: "#1E40AF", accent: "#F97316" },
        featureFlags: { revtry: cfg.plan !== "free", ads: cfg.plan === "agency" },
        aiTrainingOptIn: cfg.plan === "agency",
      },
    });
  }
}

async function seedMembers(tx: SeedClient, workspaceId: string) {
  const planEntry = PLAN_CONFIG.find(
    (c) => workspaceIdFor(c.plan) === workspaceId
  );
  if (!planEntry) return;
  for (let i = 0; i < ROLE_USERS.length; i++) {
    const role = ROLE_USERS[i]!;
    const userId = userIdFor(planEntry.plan, role.suffix);
    const memberId = makeId("wsm", 300 + i + workspaceId.length);
    await tx.workspaceMember.upsert({
      where: {
        // We rely on the natural workspace+user unique key (partial idx
        // where removed_at IS NULL); since Prisma does not understand
        // partial uniques, we look up first then upsert by id.
        id: memberId,
      },
      update: {
        role: role.role as Prisma.WorkspaceMemberCreateInput["role"],
      },
      create: {
        id: memberId,
        workspaceId,
        userId,
        role: role.role as Prisma.WorkspaceMemberCreateInput["role"],
        invitedAt: new Date(SEED_EPOCH + i * 60_000),
        joinedAt: new Date(SEED_EPOCH + i * 60_000 + 30_000),
      },
    });
  }
}

async function seedFunnels(
  tx: SeedClient,
  workspaceId: string,
  vertical: string
) {
  const owner = ownerUserIdFor(workspaceId);
  for (let i = 0; i < 5; i++) {
    const funnelId = makeId("fnl", 400 + i + workspaceId.length);
    const versionId = makeId("fvr", 500 + i + workspaceId.length);
    const slug = `${vertical}-funnel-${i + 1}`;

    await tx.funnel.upsert({
      where: { id: funnelId },
      update: { name: `${vertical} Funnel ${i + 1}` },
      create: {
        id: funnelId,
        workspaceId,
        name: `${vertical} Funnel ${i + 1}`,
        slug,
        status: i === 0 ? "live" : i === 1 ? "review" : "draft",
        vertical,
        createdBy: owner,
        aiDisclosure: { enabled: true, label: "Built with AI by GoFunnelAI" },
      },
    });

    await tx.funnelVersion.upsert({
      where: { id: versionId },
      update: {},
      create: {
        id: versionId,
        workspaceId,
        funnelId,
        versionNumber: 1,
        source: "agent",
        artifactHash: `sha256:${i}${workspaceId.slice(-8)}`,
        bundleS3Uri: `s3://funnel-lake/funnels/${funnelId}/v1/bundle.json`,
        copyBlob: { headline: `${vertical} winning copy v1`, _schema_version: 1 },
        designBlob: { theme: "modern-blue", _schema_version: 1 },
        configBlob: { pages: ["/", "/thanks"], routing: "static" },
        complianceBlob: { vertical, disclosures: ["ai", "marketing"] },
        qualityScore: 87.5,
        isPublished: i === 0,
        publishedAt: i === 0 ? new Date(SEED_EPOCH + 86_400_000) : null,
        publishedBy: i === 0 ? owner : null,
      },
    });

    await tx.funnel.update({
      where: { id: funnelId },
      data: { currentVersionId: versionId, liveUrl: i === 0 ? `https://${slug}.funnel.dev` : null },
    });
  }
}

function ownerUserIdFor(workspaceId: string): string {
  const planEntry = PLAN_CONFIG.find(
    (c) => workspaceIdFor(c.plan) === workspaceId
  );
  if (!planEntry) throw new Error(`unknown workspace ${workspaceId}`);
  return userIdFor(planEntry.plan, "owner");
}

async function seedCrmAndLeads(tx: SeedClient, workspaceId: string) {
  // Pull the first funnel for each workspace as the capture source.
  const funnel = await tx.funnel.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    include: { versions: { take: 1 } },
  });
  if (!funnel || !funnel.versions[0]) return;
  const funnelVersionId = funnel.versions[0].id;

  for (let i = 0; i < 10; i++) {
    const contactId = makeId("crm", 600 + i + workspaceId.length);
    const leadId = makeId("lds", 700 + i + workspaceId.length);

    await tx.crmContact.upsert({
      where: { id: contactId },
      update: {},
      create: {
        id: contactId,
        workspaceId,
        emailNormalized: `lead${i + 1}@example.com`,
        emailSha256: "a".repeat(64),
        phoneE164: `+1555010${(1000 + i).toString().padStart(4, "0")}`,
        phoneSha256: "b".repeat(64),
        firstName: `Lead${i + 1}`,
        lastName: "Demo",
        fullName: `Lead${i + 1} Demo`,
        tags: i % 2 === 0 ? ["hot", "newsletter"] : ["warm"],
        consent: { marketing: true, sms: i % 2 === 0, calls: i % 3 === 0 },
        primarySource: "landing_page_form",
      },
    });

    await tx.lead.upsert({
      where: { id: leadId },
      update: {},
      create: {
        id: leadId,
        workspaceId,
        funnelId: funnel.id,
        funnelVersionId,
        crmContactId: contactId,
        status: ["new", "contacted", "qualified", "booked", "converted"][i % 5] as Prisma.LeadCreateInput["status"],
        score: 50 + i * 4,
        scoreBand: i < 3 ? "hot" : i < 7 ? "warm" : "cold",
        scoreModelVersion: "2026.05.18-c",
        captureSource: "landing_page_form",
        captureUrl: `https://${funnel.slug}.funnel.dev/?utm_source=seed`,
        utm: { source: "seed", medium: "fixture", campaign: "demo" },
        geoCountry: "US",
        geoRegion: "NY",
      },
    });
  }

  // Bookings for the first 3 leads.
  const leadsForBooking = await tx.lead.findMany({
    where: { workspaceId },
    take: 3,
    orderBy: { createdAt: "asc" },
  });
  const host = ownerUserIdFor(workspaceId);
  for (let i = 0; i < leadsForBooking.length; i++) {
    const lead = leadsForBooking[i]!;
    const bookingId = makeId("bkg", 800 + i + workspaceId.length);
    await tx.booking.upsert({
      where: { id: bookingId },
      update: {},
      create: {
        id: bookingId,
        workspaceId,
        leadId: lead.id,
        funnelId: lead.funnelId,
        hostUserId: host,
        externalCalendar: "google",
        scheduledFor: new Date(SEED_EPOCH + 86_400_000 * (7 + i)),
        durationMinutes: 30,
        meetingUrl: `https://meet.example.com/${bookingId}`,
        status: "confirmed",
      },
    });
  }
}

async function seedBillingFor(
  tx: SeedClient,
  workspaceId: string,
  plan: string
) {
  const subId = makeId("sub", 900 + workspaceId.length);
  const invId = makeId("inv", 1000 + workspaceId.length);
  const payId = makeId("pay", 1100 + workspaceId.length);

  const unitAmountMicros =
    plan === "free"
      ? 0n
      : plan === "starter"
        ? 4_900_000n
        : plan === "growth"
          ? 19_900_000n
          : 99_900_000n;

  await tx.subscription.upsert({
    where: { id: subId },
    update: { plan, unitAmountMicros },
    create: {
      id: subId,
      workspaceId,
      plan,
      status: plan === "free" ? "trialing" : "active",
      externalProcessor: "stripe",
      externalSubscriptionId: `sub_seed_${plan}`,
      externalCustomerId: `cus_seed_${plan}`,
      currentPeriodStart: new Date(SEED_EPOCH),
      currentPeriodEnd: new Date(SEED_EPOCH + 30 * 86_400_000),
      trialEndsAt: plan === "free" ? new Date(SEED_EPOCH + 14 * 86_400_000) : null,
      unitAmountMicros,
      currency: "USD",
      quantity: 1,
    },
  });

  if (plan === "free") return;

  await tx.invoice.upsert({
    where: { id: invId },
    update: {},
    create: {
      id: invId,
      workspaceId,
      subscriptionId: subId,
      externalProcessor: "stripe",
      externalInvoiceId: `in_seed_${plan}`,
      status: "paid",
      number: `F-${plan.toUpperCase()}-0001`,
      amountDueMicros: unitAmountMicros,
      amountPaidMicros: unitAmountMicros,
      currency: "USD",
      periodStart: new Date(SEED_EPOCH),
      periodEnd: new Date(SEED_EPOCH + 30 * 86_400_000),
      paidAt: new Date(SEED_EPOCH + 60_000),
      lineItems: [
        {
          description: `${plan} plan — monthly`,
          amountMicros: Number(unitAmountMicros),
          currency: "USD",
        },
      ],
    },
  });

  await tx.payment.upsert({
    where: { id: payId },
    update: {},
    create: {
      id: payId,
      workspaceId,
      invoiceId: invId,
      externalProcessor: "stripe",
      externalPaymentId: `pi_seed_${plan}`,
      amountMicros: unitAmountMicros,
      currency: "USD",
      status: "succeeded",
      paymentMethodType: "card",
      paidAt: new Date(SEED_EPOCH + 60_000),
    },
  });
}

async function seedAuditLogFor(tx: SeedClient, workspaceId: string) {
  const actor = ownerUserIdFor(workspaceId);
  const entries: Array<Prisma.AuditLogCreateInput> = [
    {
      id: makeId("aud", 1200 + workspaceId.length),
      workspaceId,
      action: "workspace.created",
      subjectType: "workspace",
      subjectId: workspaceId,
      actor: { connect: { id: actor } },
      afterBlob: { workspaceId, by: actor },
      reason: "seed",
      piiTier: "P1",
      occurredAt: new Date(SEED_EPOCH),
    },
    {
      id: makeId("aud", 1300 + workspaceId.length),
      workspaceId,
      action: "funnel.published",
      subjectType: "funnel",
      subjectId: makeId("fnl", 400 + workspaceId.length), // matches first funnel in seedFunnels
      actor: { connect: { id: actor } },
      afterBlob: { funnel_version: 1 },
      reason: "seed",
      piiTier: "P1",
      occurredAt: new Date(SEED_EPOCH + 86_400_000),
    },
  ];
  for (const entry of entries) {
    try {
      await tx.auditLog.create({ data: entry });
    } catch (err: unknown) {
      // Audit log is INSERT-only; rerunning seed will conflict on (id, occurred_at) PK.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }
}

main()
  .catch((err) => {
    console.error("[seed] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
