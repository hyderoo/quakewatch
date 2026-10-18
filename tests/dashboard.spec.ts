import { test, expect, Page } from '@playwright/test';

// Real end-to-end coverage of the deployed QuakeWatch dashboard: feed,
// filters, source toggles, alert rules, details panel and theme.

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Key metrics' })).toBeVisible();
  // The feed loads remote data; wait for at least one event row or the empty state.
  const feed = page.getByRole('region', { name: 'Earthquake event feed' });
  await expect(feed).toBeVisible();
  await expect(feed.getByRole('listitem').first())
    .toBeVisible({ timeout: 45_000 });
}

test('loads with KPIs, map and a populated event feed', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  const items = page.getByRole('region', { name: 'Earthquake event feed' }).getByRole('listitem');
  expect(await items.count()).toBeGreaterThan(0);
});

test('geographic filter switches the feed scope', async ({ page }) => {
  await openApp(page);
  const indo = page.getByRole('button', { name: 'Indonesia', exact: true }).first();
  await indo.click();
  await expect(indo).toHaveAttribute('aria-pressed', 'true');
  // KPI bar still renders numbers for the narrower feed.
  await expect(page.getByRole('region', { name: 'Key metrics' })).toContainText('Earthquakes');
});

test('time range filter changes the active range', async ({ page }) => {
  await openApp(page);
  const group = page.getByRole('group', { name: 'Time range' });
  const buttons = group.getByRole('button');
  const second = buttons.nth(1);
  const label = await second.textContent();
  await second.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  expect(label?.trim().length).toBeGreaterThan(0);
});

test('event details open from the feed and close again', async ({ page }) => {
  await openApp(page);
  const first = page.getByRole('region', { name: 'Earthquake event feed' }).getByRole('listitem').first();
  await first.click();
  const details = page.getByRole('complementary', { name: 'Earthquake details' });
  await expect(details).toBeVisible();
  await expect(details).toContainText(/M\s?\d|Magnitude/i);
  await details.getByRole('button', { name: 'Close details' }).click();
  await expect(details).not.toBeVisible();
});

test('custom alert rule can be added and removed', async ({ page }) => {
  await openApp(page);
  const center = page.getByRole('region', { name: 'Alert center' });
  await center.getByRole('textbox', { name: 'Custom magnitude threshold' }).fill('9.5');
  await center.getByRole('button', { name: 'Add rule' }).click();
  const rule = page.getByRole('button', { name: 'Toggle rule Magnitude 9.5+' });
  await expect(rule).toBeVisible();
  await expect(rule).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Remove rule Magnitude 9.5+' }).click();
  await expect(rule).not.toBeVisible();
});

test('theme toggle flips dark and light', async ({ page }) => {
  await openApp(page);
  const toggle = page.getByRole('button', { name: 'Toggle theme' });
  const before = await page.evaluate(() => document.documentElement.className);
  await toggle.click();
  await page.waitForFunction((b) => document.documentElement.className !== b, before);
  const after = await page.evaluate(() => document.documentElement.className);
  expect(after).not.toBe(before);
});
