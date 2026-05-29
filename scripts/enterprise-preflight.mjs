#!/usr/bin/env node

const groups = [
  ["Database", ["DATABASE_URL", "DIRECT_DATABASE_URL"]],
  ["Auth", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "JWT_SECRET", "ENCRYPTION_KEY"]],
  ["AI", ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]],
  ["Images", ["REPLICATE_API_TOKEN"]],
  ["Storage", ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]],
  ["Email", ["RESEND_API_KEY"]],
  ["Payments", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"]],
  ["SignalWire", ["SIGNALWIRE_PROJECT_ID", "SIGNALWIRE_API_TOKEN", "SIGNALWIRE_SPACE_URL", "SIGNALWIRE_FROM_NUMBER"]],
  ["Observability", ["SENTRY_DSN"]],
  ["Railway", ["RAILWAY_ENVIRONMENT", "NEXT_PUBLIC_APP_URL"]],
];

const rows = groups.map(([name, keys]) => {
  const missing = keys.filter((key) => !process.env[key]);
  return { name, ready: missing.length === 0, missing };
});

for (const row of rows) {
  const mark = row.ready ? "OK" : "MISSING";
  console.log(`${mark} ${row.name}${row.ready ? "" : `: ${row.missing.join(", ")}`}`);
}

if (rows.some((row) => !row.ready)) {
  process.exitCode = 1;
}
