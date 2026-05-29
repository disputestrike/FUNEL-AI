import { test, expect } from '@playwright/test';

test('full user journey: signup -> generate -> preview -> publish -> submit form', async ({ page, context }) => {
  // 1. Sign in (mocked Google OAuth in dev)
  await page.goto('http://localhost:3000/login');
  await page.click('button:has-text("Continue with Google")');
  // In dev/test mode, mock Google callback
  await page.waitForURL(/welcome|onboarding|dashboard/, { timeout: 10000 });

  // 2. Pick form onboarding mode
  await page.click('text=Form');
  await page.fill('textarea[name=businessDescription]', 'Phoenix solar installer specializing in tax-credit-eligible installations');
  await page.click('button:has-text("Generate")');

  // 3. Watch generation stream
  await expect(page.locator('text=Planning your campaign')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Writing your hook')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('text=Looks great')).toBeVisible({ timeout: 90000 });

  // 4. Verify visual preview rendered (not JSON)
  await expect(page.locator('.funnel-preview')).toBeVisible();
  await expect(page.locator('pre:has-text("{")').first()).not.toBeVisible();

  // 5. Publish
  await page.click('button:has-text("Launch")');
  const slugInput = page.locator('input[name=slug]');
  await slugInput.fill(`test-solar-${Date.now()}`);
  await page.click('button:has-text("Publish")');
  await expect(page.locator('text=Your funnel is live')).toBeVisible({ timeout: 15000 });

  // 6. Get public URL + visit
  const publicUrl = await page.locator('[data-testid=public-url]').textContent();
  expect(publicUrl).toContain('gofunnelai.com');

  const newTab = await context.newPage();
  await newTab.goto(publicUrl!);

  // 7. Submit form on live funnel
  await newTab.fill('input[name=name]', 'Test Lead');
  await newTab.fill('input[name=email]', 'lead@example.com');
  await newTab.fill('input[name=phone]', '+15555555555');
  await newTab.click('button[type=submit]');
  await expect(newTab.locator('text=Thank you')).toBeVisible({ timeout: 10000 });

  // 8. Verify lead captured in CRM
  await page.goto('http://localhost:3000/dashboard/crm');
  await expect(page.locator('text=Test Lead')).toBeVisible({ timeout: 10000 });
});
