/**
 * GoFunnelAI — Command Center E2E.
 *
 * Exercises the chat-first /dashboard/command surface end-to-end:
 *   1. Sign in (Google OAuth mock in dev).
 *   2. Land on the Command Center.
 *   3. Type a launch-campaign prompt.
 *   4. Verify the assistant message picks up the "Launch a campaign" intent.
 *   5. Watch the side panel auto-open on the Campaign tab and the 11 Launch
 *      Center sub-views fill in order: Strategy → Platforms → Audiences →
 *      Copy → Images → Videos → Links → Follow-Up → Tracking → Compliance →
 *      Score.
 *   6. Click "Open in full Launch Center" → arrives at the campaign detail.
 *   7. Click the Export tab → ZIP download is initiated.
 *
 * The campaign id is returned by /api/command in the readiness preview
 * payload; we read it off the panel deep-link.
 */
import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

const LAUNCH_TAB_ORDER = [
  "strategy",
  "platforms",
  "audiences",
  "copy",
  "images",
  "videos",
  "links",
  "followup",
  "tracking",
  "compliance",
  "score",
] as const;

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.click('button:has-text("Continue with Google")');
  await page.waitForURL(/welcome|onboarding|dashboard/, { timeout: 10_000 });
}

test("Command Center: create_campaign intent end-to-end", async ({ page }) => {
  await signIn(page);

  // Drop the user on the Command Center.
  await page.goto(`${BASE_URL}/dashboard/command`);
  await expect(page.getByTestId("command-center-root")).toBeVisible();
  await expect(page.getByTestId("chat-empty-state")).toBeVisible();

  // Type the launch-campaign prompt.
  const input = page.getByTestId("command-input");
  await input.fill(
    "Create a launch campaign for my dental funnel targeting practice managers, goal: booked demos",
  );
  await page.getByTestId("command-send").click();

  // Intent classified to "Launch a campaign".
  await expect(
    page.getByTestId("intent-label").filter({ hasText: "Launch a campaign" }),
  ).toBeVisible({ timeout: 10_000 });

  // Side panel slides in on the Campaign tab.
  const sidePanel = page.getByTestId("command-side-panel");
  await expect(sidePanel).toHaveAttribute("data-open", "");
  await expect(page.getByTestId("campaign-preview-tab")).toBeVisible();

  // Each of the 11 Launch Center sub-views fills in order.
  for (const slot of LAUNCH_TAB_ORDER) {
    await expect(
      page.getByTestId(`launch-tab-${slot}`),
    ).toHaveAttribute("data-status", "done", { timeout: 20_000 });
  }

  // Click "Open in full Launch Center" — the chat side-panel deep-link.
  const [campaignNav] = await Promise.all([
    page.waitForURL(/\/dashboard\/campaigns\/cmp_/, { timeout: 10_000 }),
    page.getByTestId("open-full-launch-center").click(),
  ]);
  expect(campaignNav).toBeTruthy();
  await expect(page).toHaveURL(/\/dashboard\/campaigns\/cmp_/);

  // Click "Export" tab inside the cockpit → ZIP download initiates.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    page.getByRole("link", { name: /Export/i }).first().click().catch(async () => {
      // If Export is a tab page, navigate then click the download button.
      const url = page.url();
      await page.goto(url.replace(/\/campaigns\/(cmp_\w+).*$/, "/campaigns/$1/export"));
      await page.getByRole("button", { name: /(Download|Export)/i }).first().click();
    }),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/i);
});

test("Command Center: empty-state suggested prompts pre-fill input", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${BASE_URL}/dashboard/command`);

  const firstSuggested = page.getByTestId("suggested-prompt").first();
  await expect(firstSuggested).toBeVisible();
  const text = (await firstSuggested.textContent())?.trim() ?? "";
  await firstSuggested.click();

  const input = page.getByTestId("command-input");
  await expect(input).toHaveValue(text);
});

test("Command Center: quick action chips pre-fill starter templates", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${BASE_URL}/dashboard/command`);

  await page.getByTestId("quick-action-create-campaign").click();
  const input = page.getByTestId("command-input");
  await expect(input).toHaveValue(/Create a launch campaign/);
});
